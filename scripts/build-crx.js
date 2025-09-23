#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

class CrxBuilder {
  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
    this.deployDir = path.resolve(__dirname, '..');
    this.docsDir = path.join(this.rootDir, 'docs');
  }

  /**
   * 소스 파일들을 ZIP으로 압축
   */
  async createZip(version) {
    console.log('📦 Extension 파일들을 ZIP으로 압축 중...');

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const buffers = [];

      archive.on('data', (data) => buffers.push(data));
      archive.on('end', () => {
        const zipBuffer = Buffer.concat(buffers);
        console.log(`✅ ZIP 압축 완료 (${zipBuffer.length} bytes)`);
        resolve(zipBuffer);
      });
      archive.on('error', reject);

      // manifest.json 처리 (update_url 제거)
      const manifestPath = path.join(this.rootDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // 패키징용 manifest에서 update_url 제거
      const packageManifest = { ...manifest };
      delete packageManifest.update_url;

      archive.append(JSON.stringify(packageManifest, null, 2), { name: 'manifest.json' });

      // 다른 필요한 파일들 추가
      const filesToInclude = [
        'background.js',
        'bulk-translator.js',
        'gpt-option-translate.js',
        'popup.html',
        'popup.js',
        'options.html',
        'settings.js',
        'styles.css',
        'icon16.png',
        'icon48.png',
        'icon128.png'
      ];

      filesToInclude.forEach(file => {
        const filePath = path.join(this.rootDir, file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        } else {
          console.warn(`⚠️ 파일을 찾을 수 없음: ${file}`);
        }
      });

      archive.finalize();
    });
  }

  /**
   * CRX3 헤더 생성
   */
  createCrxHeader(publicKeyDer, signatureBuffer) {
    console.log('🔐 CRX3 헤더 생성 중...');

    // CRX3 매직 넘버
    const magic = Buffer.from('Cr24', 'utf8');

    // 버전 (3)
    const version = Buffer.alloc(4);
    version.writeUInt32LE(3, 0);

    // 공개키 길이
    const publicKeyLength = Buffer.alloc(4);
    publicKeyLength.writeUInt32LE(publicKeyDer.length, 0);

    // 서명 길이
    const signatureLength = Buffer.alloc(4);
    signatureLength.writeUInt32LE(signatureBuffer.length, 0);

    // 헤더 조합
    const header = Buffer.concat([
      magic,
      version,
      publicKeyLength,
      signatureLength,
      publicKeyDer,
      signatureBuffer
    ]);

    console.log(`✅ CRX3 헤더 생성 완료 (${header.length} bytes)`);
    return header;
  }

  /**
   * CRX 파일 빌드
   */
  async buildCrx(privateKeyPem, version) {
    console.log(`🔨 CRX 파일 빌드 시작 (버전: ${version})...`);

    try {
      // 1. ZIP 파일 생성
      const zipBuffer = await this.createZip(version);

      // 2. 개인키로 서명 생성
      console.log('🔑 ZIP 파일 서명 중...');

      // GitHub Secrets에서 줄바꿈이 손실될 수 있으므로 정규화
      let normalizedKeyPem = privateKeyPem;
      if (!normalizedKeyPem.includes('\n')) {
        // 줄바꿈이 없는 경우 복원
        normalizedKeyPem = normalizedKeyPem
          .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
          .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
          .replace(/(.{64})/g, '$1\n')
          .replace(/\n\n/g, '\n')
          .replace(/\n-----END/, '\n-----END');
      }

      console.log('🔍 개인키 포맷 확인 중...');
      const privateKey = crypto.createPrivateKey({
        key: normalizedKeyPem,
        format: 'pem',
        type: 'pkcs8'
      });
      const signature = crypto.sign('sha256', zipBuffer, privateKey);

      // 3. 공개키 추출
      const publicKey = crypto.createPublicKey(privateKey);
      const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });

      // 4. CRX 헤더 생성
      const header = this.createCrxHeader(publicKeyDer, signature);

      // 5. CRX 파일 조합
      const crxBuffer = Buffer.concat([header, zipBuffer]);

      // 6. 파일 저장
      const crxFileName = `shoppy-extension-${version}.crx`;
      const crxPath = path.join(this.docsDir, crxFileName);

      // docs 디렉토리 생성
      if (!fs.existsSync(this.docsDir)) {
        fs.mkdirSync(this.docsDir, { recursive: true });
      }

      fs.writeFileSync(crxPath, crxBuffer);

      console.log(`✅ CRX 파일 생성 완료: ${crxFileName}`);
      console.log(`📁 저장 위치: ${crxPath}`);
      console.log(`📊 파일 크기: ${crxBuffer.length} bytes`);

      return {
        crxPath,
        crxFileName,
        extensionId: this.generateExtensionId(publicKeyDer)
      };

    } catch (error) {
      console.error('❌ CRX 빌드 실패:', error.message);
      throw error;
    }
  }

  /**
   * Extension ID 생성
   */
  generateExtensionId(publicKeyDer) {
    const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
    return hash.slice(0, 16).toString('hex').replace(/./g, c =>
      String.fromCharCode(97 + parseInt(c, 16))
    );
  }

  /**
   * 버전 정보 검증
   */
  validateVersion(expectedVersion) {
    const manifestPath = path.join(this.rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.version !== expectedVersion) {
      throw new Error(`버전 불일치: manifest.json(${manifest.version}) != 예상(${expectedVersion})`);
    }

    console.log(`✅ 버전 검증 통과: ${expectedVersion}`);
    return manifest.version;
  }

  /**
   * 메인 빌드 프로세스
   */
  async build(privateKeyPem, version) {
    try {
      console.log('🚀 CRX 빌드 프로세스 시작...\n');

      // 버전 검증
      this.validateVersion(version);

      // CRX 빌드
      const result = await this.buildCrx(privateKeyPem, version);

      console.log('\n🎉 CRX 빌드 완료!');
      return result;

    } catch (error) {
      console.error('\n💥 CRX 빌드 실패:', error.message);
      throw error;
    }
  }
}

// CLI에서 직접 실행될 때
if (require.main === module) {
  const version = process.env.RELEASE_VERSION || process.argv[2];
  const privateKeyPem = process.env.CRX_PRIVATE_KEY_PEM;

  if (!version) {
    console.error('❌ 버전이 지정되지 않았습니다.');
    console.log('사용법: node build-crx.js <version>');
    console.log('또는 환경변수: RELEASE_VERSION=1.6.2 node build-crx.js');
    process.exit(1);
  }

  if (!privateKeyPem) {
    console.error('❌ CRX_PRIVATE_KEY_PEM 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const builder = new CrxBuilder();
  builder.build(privateKeyPem, version)
    .then(result => {
      console.log(`✅ 빌드 성공: ${result.crxFileName}`);
      console.log(`📋 Extension ID: ${result.extensionId}`);
    })
    .catch(error => {
      console.error('❌ 빌드 실패:', error.message);
      process.exit(1);
    });
}

module.exports = CrxBuilder;