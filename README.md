# Chrome Extension 자동 업데이트 시스템

이 디렉토리는 Shoppy Chrome Extension의 자동 업데이트 시스템을 구현합니다.

## 🏗️ 구조

```
deploy/
├── scripts/
│   ├── setup-keys.js       # Extension 키 생성 및 설정
│   ├── build-crx.js        # CRX 파일 빌드
│   └── generate-update-xml.js # update.xml 생성
├── templates/
│   └── update.xml.template # update.xml 템플릿
├── key-info.json          # Extension 키 정보 (자동 생성)
└── package.json           # 의존성 관리
```

## 🚀 사용법

### 1. 초기 설정

```bash
# 의존성 설치
cd deploy
npm install

# Extension 키 생성 및 설정
node scripts/setup-keys.js
```

이 명령은 다음을 수행합니다:
- RSA 2048bit 키 페어 생성
- GitHub Secrets에 개인키 등록 (CRX_PRIVATE_KEY_PEM)
- manifest.json에 update_url과 key 추가
- Extension ID 고정

### 2. 수동 빌드 (테스트용)

```bash
# CRX 파일 빌드
RELEASE_VERSION=1.6.2 CRX_PRIVATE_KEY_PEM="$(cat private-key.pem)" node scripts/build-crx.js

# update.xml 생성
RELEASE_VERSION=1.6.2 node scripts/generate-update-xml.js
```

### 3. 자동 배포 (GitHub Actions)

GitHub 릴리즈를 생성하면 자동으로:
1. 버전 검증 (태그 vs manifest.json)
2. CRX 파일 빌드 및 서명
3. update.xml 생성
4. GitHub Pages에 배포
5. 릴리즈 에셋에 CRX 업로드

## 🔧 시스템 구성

### Chrome Extension 자동 업데이트 체인

```
Chrome Browser
    ↓ (주기적 체크)
GitHub Pages: update.xml
    ↓ (새 버전 감지)
GitHub Pages: .crx 파일
    ↓ (자동 다운로드)
Chrome Extension 자동 설치
```

### 핵심 구성 요소

1. **update.xml**: Chrome이 업데이트를 확인하는 XML 파일
2. **.crx 파일**: 서명된 Extension 패키지
3. **Extension ID**: 공개키로부터 생성되는 고정 ID
4. **update_url**: manifest.json에 설정된 업데이트 확인 URL

## 📋 설정 정보

### Extension 정보
- **Extension ID**: `cccpnlnljpmmfmpnjdneofielcnlpgpl`
- **Update URL**: `https://reyfafa.github.io/ShoppyDelight/update.xml`
- **Download URL**: `https://reyfafa.github.io/ShoppyDelight/shoppy-extension-{version}.crx`

### GitHub 설정
- **Repository**: `ReyFaFa/ShoppyDelight`
- **GitHub Pages**: 활성화 필요 (Settings > Pages > Source: GitHub Actions)
- **Secret**: `CRX_PRIVATE_KEY_PEM` (자동 설정됨)

## 🔐 보안

### 개인키 관리
- 개인키는 GitHub Secrets에만 저장됩니다
- 로컬에는 저장되지 않습니다
- CI/CD에서만 접근 가능합니다

### Extension 서명
- CRX 파일은 RSA 2048bit 키로 서명됩니다
- Chrome이 서명을 검증하여 무결성을 보장합니다
- Extension ID가 고정되어 일관된 업데이트가 가능합니다

## 🔄 업데이트 프로세스

### 개발자 (릴리즈 생성)
```bash
git tag v1.6.3
git push origin v1.6.3
gh release create v1.6.3 --title "v1.6.3: New Features" --notes "..."
```

### GitHub Actions (자동 실행)
1. 버전 검증
2. CRX 빌드
3. update.xml 생성
4. GitHub Pages 배포

### Chrome Browser (자동 실행)
1. update.xml 확인 (주기적)
2. 새 버전 감지
3. CRX 다운로드
4. 자동 설치
5. 사용자 알림

## 📊 모니터링

### 배포 상태 확인
- GitHub Actions: 빌드 및 배포 로그
- GitHub Pages: 배포된 파일 확인
- Chrome Extensions: 업데이트 상태 확인

### 업데이트 성공률
- Chrome Developer Dashboard에서 확인 가능
- Extension 사용자 통계로 업데이트 현황 파악

## 🛠️ 문제 해결

### 일반적인 문제들

1. **키 생성 실패**
   ```bash
   # GitHub CLI 로그인 확인
   gh auth status

   # 수동으로 Secret 등록
   gh secret set CRX_PRIVATE_KEY_PEM --body "$(cat private-key.pem)"
   ```

2. **빌드 실패**
   ```bash
   # 버전 일치 확인
   git tag --list
   cat manifest.json | grep version

   # 의존성 재설치
   npm install
   ```

3. **업데이트 안됨**
   - GitHub Pages 활성화 확인
   - update.xml 접근 가능 확인
   - Extension ID 일치 확인

## 📚 참고 자료

- [Chrome Extension Auto-updating](https://developer.chrome.com/docs/extensions/mv3/linux_hosting/)
- [CRX File Format](https://developer.chrome.com/docs/extensions/mv3/linux_hosting/#crx)
- [GitHub Actions](https://docs.github.com/en/actions)
- [GitHub Pages](https://docs.github.com/en/pages)