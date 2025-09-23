#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class UpdateXmlGenerator {
  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
    this.deployDir = path.resolve(__dirname, '..');
    this.docsDir = path.join(this.rootDir, 'docs');
    this.templatePath = path.join(this.deployDir, 'templates', 'update.xml.template');
  }

  /**
   * 키 정보에서 Extension ID 추출
   */
  getExtensionId() {
    const keyInfoPath = path.join(this.deployDir, 'key-info.json');

    if (fs.existsSync(keyInfoPath)) {
      const keyInfo = JSON.parse(fs.readFileSync(keyInfoPath, 'utf8'));
      return keyInfo.extensionId;
    }

    // key-info.json이 없으면 manifest.json에서 key를 읽어서 계산
    const manifestPath = path.join(this.rootDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.key) {
      const publicKeyDer = Buffer.from(manifest.key, 'base64');
      return this.generateExtensionId(publicKeyDer);
    }

    throw new Error('Extension ID를 찾을 수 없습니다. 먼저 setup-keys.js를 실행해주세요.');
  }

  /**
   * Extension ID 생성 (공개키로부터)
   */
  generateExtensionId(publicKeyDer) {
    const hash = crypto.createHash('sha256').update(publicKeyDer).digest();
    return hash.slice(0, 16).toString('hex').replace(/./g, c =>
      String.fromCharCode(97 + parseInt(c, 16))
    );
  }

  /**
   * update.xml 생성
   */
  generateUpdateXml(version, extensionId) {
    console.log(`📝 update.xml 생성 중... (버전: ${version})`);

    try {
      // 템플릿 로드
      const template = fs.readFileSync(this.templatePath, 'utf8');

      // 변수 치환
      const crxFileName = `shoppy-extension-${version}.crx`;
      const crxUrl = `https://reyfafa.github.io/ShoppyDelight/${crxFileName}`;

      const updateXml = template
        .replace(/{{VERSION}}/g, version)
        .replace(/{{EXTENSION_ID}}/g, extensionId)
        .replace(/{{CRX_URL}}/g, crxUrl);

      // docs 디렉토리에 저장
      if (!fs.existsSync(this.docsDir)) {
        fs.mkdirSync(this.docsDir, { recursive: true });
      }

      const updateXmlPath = path.join(this.docsDir, 'update.xml');
      fs.writeFileSync(updateXmlPath, updateXml);

      console.log('✅ update.xml 생성 완료');
      console.log(`📁 저장 위치: ${updateXmlPath}`);
      console.log(`🌐 CRX URL: ${crxUrl}`);
      console.log(`📋 Extension ID: ${extensionId}`);

      return {
        updateXmlPath,
        crxUrl,
        extensionId
      };

    } catch (error) {
      console.error('❌ update.xml 생성 실패:', error.message);
      throw error;
    }
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
   * CRX 파일 존재 확인
   */
  validateCrxFile(version) {
    const crxFileName = `shoppy-extension-${version}.crx`;
    const crxPath = path.join(this.docsDir, crxFileName);

    if (!fs.existsSync(crxPath)) {
      throw new Error(`CRX 파일을 찾을 수 없습니다: ${crxFileName}`);
    }

    const stats = fs.statSync(crxPath);
    console.log(`✅ CRX 파일 확인: ${crxFileName} (${stats.size} bytes)`);
    return crxPath;
  }

  /**
   * GitHub Pages용 index.html 생성 (선택사항)
   */
  generateIndexHtml(version, extensionId) {
    const indexHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shoppy Extension - Auto Update</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .download { background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0; }
        code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🛍️ Shoppy Extension</h1>
    <p>Chinese to Korean Translator with Bulk Image Translation</p>

    <div class="info">
        <h3>📋 Extension 정보</h3>
        <ul>
            <li><strong>현재 버전:</strong> ${version}</li>
            <li><strong>Extension ID:</strong> <code>${extensionId}</code></li>
            <li><strong>Update URL:</strong> <code>https://reyfafa.github.io/ShoppyDelight/update.xml</code></li>
        </ul>
    </div>

    <div class="download">
        <h3>📦 수동 다운로드</h3>
        <p>Chrome Extension은 자동으로 업데이트됩니다. 수동 설치가 필요한 경우에만 아래 링크를 사용하세요.</p>
        <a href="shoppy-extension-${version}.crx" download>
            📥 shoppy-extension-${version}.crx 다운로드
        </a>
    </div>

    <div class="info">
        <h3>🔄 자동 업데이트</h3>
        <p>이 Extension은 Chrome의 자동 업데이트 시스템을 사용합니다:</p>
        <ul>
            <li>Chrome이 주기적으로 update.xml을 확인합니다</li>
            <li>새 버전이 있으면 자동으로 다운로드하고 설치합니다</li>
            <li>사용자의 별도 작업은 필요하지 않습니다</li>
        </ul>
    </div>

    <footer style="margin-top: 40px; text-align: center; color: #666;">
        <p>Generated: ${new Date().toISOString()}</p>
    </footer>
</body>
</html>`;

    const indexPath = path.join(this.docsDir, 'index.html');
    fs.writeFileSync(indexPath, indexHtml);
    console.log(`📄 index.html 생성: ${indexPath}`);
  }

  /**
   * 메인 생성 프로세스
   */
  async generate(version) {
    try {
      console.log('🚀 update.xml 생성 프로세스 시작...\n');

      // 1. 버전 검증
      this.validateVersion(version);

      // 2. CRX 파일 존재 확인
      this.validateCrxFile(version);

      // 3. Extension ID 추출
      const extensionId = this.getExtensionId();

      // 4. update.xml 생성
      const result = this.generateUpdateXml(version, extensionId);

      // 5. index.html 생성 (선택사항)
      this.generateIndexHtml(version, extensionId);

      console.log('\n🎉 update.xml 생성 완료!');
      return result;

    } catch (error) {
      console.error('\n💥 update.xml 생성 실패:', error.message);
      throw error;
    }
  }
}

// CLI에서 직접 실행될 때
if (require.main === module) {
  const version = process.env.RELEASE_VERSION || process.argv[2];

  if (!version) {
    console.error('❌ 버전이 지정되지 않았습니다.');
    console.log('사용법: node generate-update-xml.js <version>');
    console.log('또는 환경변수: RELEASE_VERSION=1.6.2 node generate-update-xml.js');
    process.exit(1);
  }

  const generator = new UpdateXmlGenerator();
  generator.generate(version)
    .then(result => {
      console.log(`✅ 생성 성공: update.xml`);
      console.log(`🌐 Update URL: https://reyfafa.github.io/ShoppyDelight/update.xml`);
    })
    .catch(error => {
      console.error('❌ 생성 실패:', error.message);
      process.exit(1);
    });
}

module.exports = UpdateXmlGenerator;