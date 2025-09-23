#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ExtensionKeyManager {
  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
    this.manifestPath = path.join(this.rootDir, 'manifest.json');
  }

  /**
   * Chrome Extension용 키 페어 생성
   */
  generateKeyPair() {
    console.log('🔑 RSA 키 페어 생성 중...');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Chrome Extension key 포맷으로 변환
    const publicKeyDer = crypto.createPublicKey(publicKey).export({
      type: 'spki',
      format: 'der'
    });

    const chromeKey = publicKeyDer.toString('base64');

    console.log('✅ 키 페어 생성 완료');
    return { privateKey, publicKey, chromeKey };
  }

  /**
   * 공개키로부터 Extension ID 생성
   */
  generateExtensionId(publicKeyDer) {
    const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
    // Chrome Extension ID는 16바이트를 a-p 문자로 변환
    return hash.slice(0, 16).toString('hex').replace(/./g, c =>
      String.fromCharCode(97 + parseInt(c, 16))
    );
  }

  /**
   * GitHub Secrets에 Base64 개인키 등록
   */
  async setupGitHubSecrets(privateKey) {
    console.log('🔒 GitHub Secrets에 Base64 개인키 등록 중...');

    try {
      // 개인키를 Base64로 인코딩 (단일 라인)
      const privateKeyBase64 = Buffer.from(privateKey).toString('base64');

      // GitHub CLI를 사용하여 Base64 Secret 등록
      const command = `gh secret set CRX_KEY_BASE64 --body "${privateKeyBase64}"`;
      execSync(command, { stdio: 'inherit' });
      console.log('✅ GitHub Secrets에 CRX_KEY_BASE64 등록 완료');

      // 기존 PEM 시크릿 제거 (있다면)
      try {
        execSync('gh secret delete CRX_PRIVATE_KEY_PEM', { stdio: 'ignore' });
        console.log('🗑️ 기존 CRX_PRIVATE_KEY_PEM 시크릿 제거됨');
      } catch (e) {
        // 시크릿이 없는 경우 무시
      }

    } catch (error) {
      console.error('❌ GitHub Secrets 등록 실패:', error.message);
      console.log('💡 수동으로 GitHub 레포 Settings > Secrets에서 CRX_KEY_BASE64를 등록해주세요.');
      console.log('📋 Base64 개인키 (단일 라인):');
      console.log(Buffer.from(privateKey).toString('base64'));
      throw error;
    }
  }

  /**
   * manifest.json 업데이트
   */
  updateManifest(chromeKey, extensionId) {
    console.log('📝 manifest.json 업데이트 중...');

    try {
      const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));

      // update_url과 key 추가
      manifest.update_url = 'https://reyfafa.github.io/ShoppyDelight/update.xml';
      manifest.key = chromeKey;

      // 포맷팅하여 저장
      fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2));

      console.log('✅ manifest.json 업데이트 완료');
      console.log(`📋 Extension ID: ${extensionId}`);
      console.log(`🌐 Update URL: ${manifest.update_url}`);
    } catch (error) {
      console.error('❌ manifest.json 업데이트 실패:', error.message);
      throw error;
    }
  }

  /**
   * 키 정보를 파일로 저장 (백업용)
   */
  saveKeyInfo(extensionId, publicKey, chromeKey) {
    const keyInfo = {
      extensionId,
      generated: new Date().toISOString(),
      publicKey: publicKey,
      chromeKey: chromeKey,
      updateUrl: 'https://reyfafa.github.io/ShoppyDelight/update.xml'
    };

    const keyInfoPath = path.join(__dirname, '../key-info.json');
    fs.writeFileSync(keyInfoPath, JSON.stringify(keyInfo, null, 2));
    console.log(`💾 키 정보 저장됨: ${keyInfoPath}`);
  }

  /**
   * 전체 설정 프로세스 실행
   */
  async setup() {
    try {
      console.log('🚀 Chrome Extension 키 생성 및 설정 시작...\n');

      // 1. 키 페어 생성
      const { privateKey, publicKey, chromeKey } = this.generateKeyPair();

      // 2. Extension ID 생성
      const publicKeyDer = crypto.createPublicKey(publicKey).export({
        type: 'spki',
        format: 'der'
      });
      const extensionId = this.generateExtensionId(publicKeyDer);

      // 3. GitHub Secrets 설정
      await this.setupGitHubSecrets(privateKey);

      // 4. manifest.json 업데이트
      this.updateManifest(chromeKey, extensionId);

      // 5. 키 정보 백업
      this.saveKeyInfo(extensionId, publicKey, chromeKey);

      console.log('\n🎉 Extension 키 설정 완료!');
      console.log('📋 다음 단계:');
      console.log('  1. GitHub Pages 활성화 (Settings > Pages > Source: GitHub Actions)');
      console.log('  2. npm install 실행 (deploy 폴더에서)');
      console.log('  3. 첫 번째 릴리즈 생성으로 자동 배포 테스트');

    } catch (error) {
      console.error('\n💥 설정 실패:', error.message);
      process.exit(1);
    }
  }
}

// 메인 실행
if (require.main === module) {
  const keyManager = new ExtensionKeyManager();
  keyManager.setup();
}

module.exports = ExtensionKeyManager;