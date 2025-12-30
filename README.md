# QR WebAR 체험 시스템


## 🚀 주요 기능

- **6개의 다른 캐릭터 시스템**: 각 QR 코드마다 다른 캐릭터와 메시지 제공
- QR 코드 스캔 → 웹사이트 연결 → 카메라 화면 활용
- 캐릭터별 맞춤 등장 인사말 (점점 커지며 등장 + 간단한 텍스트 소개)
- 사진 촬영 기능 (관람객 + 캐릭터 + 배경 합성)
- 캐릭터별 촬영 완료 안내문구
- 촬영된 사진에 장소 정보 자동 표출
- 캐릭터 조작 기능 (이동, 크기 조절, 회전, 좌우반전)
- 사진 저장 및 SNS 공유 기능
- 별도 앱 설치 없이 브라우저(WebAR) 기반으로 구동

## 🛠 기술 스택

- 정적 HTML5 + CSS3
- JavaScript (Vanilla, WebRTC `getUserMedia` 사용)
- Google Fonts (Noto Sans KR)

## 📋 요구사항

- HTTPS 환경에서의 배포 권장 (카메라 접근을 위해)
- 최신 브라우저 (Chrome, Edge, Safari, Firefox)

## 🔧 배포 및 실행

1. `character1.html` ~ `character6.html` 중 원하는 파일을 웹 서버에 업로드하거나, 로컬에서 HTTPS가 적용된 환경으로 호스팅합니다.
2. 각 캐릭터에 해당하는 HTML 파일 URL을 QR 코드에 연결하면 방문자가 해당 캐릭터와 AR 촬영 체험을 진행할 수 있습니다.
3. `js/webar.js`와 `assets/` 디렉터리를 동일한 최상위 경로에 배치해야 합니다.

## 📁 프로젝트 구조

```
├── character1.html        # 사명대사 체험 페이지
├── character2.html        # 의병대장 체험 페이지
├── character3.html        # 태극나비 체험 페이지
├── character4.html        # 회화나무 체험 페이지
├── character5.html        # 청룡 체험 페이지
├── character6.html        # 금오 체험 페이지
├── css/
│   └── style.css         # 공통 스타일
├── js/
│   └── webar.js           # WebAR 기능 구현
├── assets/                # 공용 리소스 디렉토러 (사운드 및 공용이미지 리소스)
│   └── characters/      # 캐릭터 이미지 디렉토리 (c1.png ~ c6.png)
└── README.md
```

## 📱 사용 방법

### AR 체험
- 방문객이 QR 코드를 스캔
- 웹페이지 접속 시 카메라 접근 권한 요청
- 선택한 캐릭터 등장 애니메이션 + 캐릭터별 인사말
- 캐릭터 조작 (드래그로 이동, 핀치줌 크기 조절)
- 사진 촬영
- 캐릭터별 촬영 완료 안내문구 표시
- 사진 저장 및 공유

## 🎨 캐릭터 시스템

### 캐릭터 이미지
- **개수**: 총 6개 (c1.png ~ c6.png)
- **형식**: PNG (투명 배경 권장)
- **권장 크기**: 500px x 700px ~ 1000px x 1400px
- **위치**: `assets/characters/` 디렉토리
- 자세한 내용은 `assets/characters/README.md` 참고

### 공용 리소스
- **위치**: `assets/` 디렉토리
- 배경음, 효과음, 안내팝업, 가이드 이미지 파일등 위치


## 🌐 지원 디바이스

- PC Web (Chrome, Edge 등 최신 버전 브라우저)
- Mobile Web (iOS, Android 최신 버전의 기본 브라우저)

## 🔒 보안 고려사항

- HTTPS 환경에서 실행을 권장합니다. (모바일 브라우저는 HTTP에서 카메라 접근을 차단할 수 있습니다.)
