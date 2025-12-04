class WebARExperience {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.character = document.getElementById('character');
    this.introText = document.getElementById('intro-text');
    this.loading = document.getElementById('loading');
    this.permissionRequest = document.getElementById('permission-request');
    this.photoResult = document.getElementById('photo-result');
    this.capturedPhoto = document.getElementById('captured-photo');
    this.backgroundMusic = document.getElementById('background-music');
    this.characterAppearSound = document.getElementById('character-appear-sound');
    this.lightBeam = document.getElementById('light-beam');
    this.characterGround = document.getElementById('character-ground');
    this.characterGuide = document.getElementById('character-guide');
    
    this.stream = null;
    this.isCharacterVisible = false;
    this.capturedImageData = null;
    this.currentCamera = 'environment'; // 후면 카메라만 사용
    this.availableCameras = [];
    this.currentCameraIndex = 0;
    this.wasMusicPlaying = false; // 페이지 숨김 전 재생 상태 추적
    this.resumeMusicOnInteraction = null; // 사용자 상호작용 시 재생을 위한 함수
    this.isCharacterSoundPlaying = false; // 등장 효과음 재생 중 플래그
    this.isCharacterCentered = false; // 캐릭터가 중앙에 위치하는지 플래그
    this.animationFrameId = null; // requestAnimationFrame ID (성능 최적화)
    this.needsTransformUpdate = false; // transform 업데이트 필요 여부 (성능 최적화)
    
    this.characterGuideShowTimeout = null;
    this.characterGuideHideTimeout = null;
    
    // 캐릭터 상태
    this.characterState = {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipX: 1,
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      isPinching: false,
      initialPinchDistance: 0,
      initialPinchScale: 1
    };
    
    this.init();
  }
  
  async init() {
    this.hideAllElements();
    this.showLoading();
    
    try {
      console.log('카메라 초기화 시작...');
      await this.requestCameraPermission();
      console.log('카메라 권한 요청 완료');
      
      await this.startCamera();
      console.log('카메라 시작 완료');
      
      this.hideLoading();
      console.log('로딩 화면 숨김');
      
      // 스플래시 화면이 사라진 후에 빛줄기 등장 시작
      // 스플래시는 최소 3초 + 리소스 로드 시간이므로, 
      // 스플래시가 사라지면 바로 빛줄기 등장 시작하도록 설정
      // SplashManager에서 hideSplash() 호출 시 startExperience() 호출하도록 변경
    } catch (error) {
      console.error('초기화 오류:', error);
      // 에러 메시지를 전역 변수에 저장
      if (error.message) {
        window.cameraError = error.message;
      }
      this.showPermissionRequest();
    }
  }
  
  hideAllElements() {
    this.loading.style.display = 'none';
    this.permissionRequest.style.display = 'none';
    this.photoResult.style.display = 'none';
  }
  
  showLoading() {
    this.loading.style.display = 'block';
  }
  
  hideLoading() {
    this.loading.style.display = 'none';
  }
  
  showPermissionRequest() {
    this.hideLoading();
    
    // 에러 메시지가 있으면 표시
    const errorMessage = window.cameraError || '카메라 접근에 실패했습니다.';
    const messageElement = this.permissionRequest.querySelector('p');
    if (messageElement) {
      messageElement.textContent = errorMessage;
    }
    
    this.permissionRequest.style.display = 'block';
    
    document.getElementById('request-permission').addEventListener('click', () => {
      this.init();
    });
  }
  
  async requestCameraPermission() {
    try {
      // HTTPS 확인
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('HTTPS가 필요합니다. 카메라 접근을 위해 HTTPS를 사용해주세요.');
      }
      
      // MediaDevices API 지원 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.');
      }
      
      console.log('카메라 권한 요청 중...');
      
      // 사용 가능한 카메라 목록 가져오기
      await this.getAvailableCameras();
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // 후면 카메라만 사용
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      });
      
      console.log('카메라 권한 허용됨');
      return true;
    } catch (error) {
      console.error('카메라 권한 오류:', error);
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '카메라 접근에 실패했습니다.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '이 브라우저는 카메라를 지원하지 않습니다.';
      } else if (error.message.includes('HTTPS')) {
        errorMessage = error.message;
      }
      
      // 에러 메시지를 전역 변수에 저장
      window.cameraError = errorMessage;
      throw error;
    }
  }
  
  async startCamera() {
    if (!this.stream) {
      throw new Error('카메라 스트림이 없습니다.');
    }
    
    this.video.srcObject = this.stream;
    
    return new Promise((resolve, reject) => {
      // 타임아웃 설정 (10초)
      const timeout = setTimeout(() => {
        reject(new Error('비디오 로드 시간 초과'));
      }, 10000);
      
      const onLoadedMetadata = () => {
        clearTimeout(timeout);
        this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.video.removeEventListener('error', onError);
        
        this.video.play().then(() => {
          this.setupCanvas();
          this.updateVideoMirror(); // 비디오 반전 적용
          console.log('카메라 시작 완료');
          resolve();
        }).catch(error => {
          console.error('비디오 재생 실패:', error);
          reject(error);
        });
      };
      
      const onError = (error) => {
        clearTimeout(timeout);
        this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.video.removeEventListener('error', onError);
        console.error('비디오 로드 오류:', error);
        reject(new Error('비디오 로드 실패'));
      };
      
      if (this.video.readyState >= 1) {
        // 이미 메타데이터가 로드된 경우
        onLoadedMetadata();
      } else {
        this.video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        this.video.addEventListener('error', onError, { once: true });
      }
    });
  }
  
  updateVideoMirror() {
    // 후면 카메라만 사용하므로 반전 없음
    this.video.style.transform = 'scaleX(1)';
  }
  
  playCharacterAppearSound() {
    if (!this.characterAppearSound) {
      console.error('캐릭터 등장 효과음 요소를 찾을 수 없습니다');
      return;
    }
    
    // 이미 재생 중이면 중복 재생 방지
    if (this.isCharacterSoundPlaying) {
      console.log('캐릭터 등장 효과음이 이미 재생 중입니다. 중복 재생 방지');
      return;
    }
    
    // 재생 중이 아니고, 실제로 재생 중인지 확인
    if (!this.characterAppearSound.paused && this.characterAppearSound.currentTime > 0) {
      console.log('캐릭터 등장 효과음이 이미 재생 중입니다. 중복 재생 방지');
      return;
    }
    
    console.log('캐릭터 등장 효과음 재생 시도');
    console.log('효과음 readyState:', this.characterAppearSound.readyState);
    
    // 재생 중 플래그 설정
    this.isCharacterSoundPlaying = true;
    
    // 효과음 볼륨 설정 (100%)
    this.characterAppearSound.volume = 1.0;
    this.characterAppearSound.currentTime = 0; // 처음부터 재생
    
    // 재생 완료 시 플래그 리셋
    const resetFlag = () => {
      this.isCharacterSoundPlaying = false;
    };
    
    // this.characterAppearSound.addEventListener('ended', resetFlag, { once: true });
    // this.characterAppearSound.addEventListener('pause', () => {
    //   // pause 이벤트는 재생 완료가 아닐 수 있으므로 주의
    //   if (this.characterAppearSound.ended || this.characterAppearSound.currentTime === 0) {
    //     resetFlag();
    //   }
    // }, { once: true });
    
    // 오디오 로드 상태 확인 및 재생
    const attemptPlay = () => {
      // 오디오가 로드되지 않았으면 로드 먼저 시도
      if (this.characterAppearSound.readyState < 2) {
        console.log('효과음 로드 중...');
        this.characterAppearSound.load();
        
        // 로드 완료 후 즉시 재생 (한 번만 실행되도록)
        let hasPlayed = false;
        const onCanPlay = () => {
          if (hasPlayed) {
            console.log('효과음 재생 이미 시도됨, 중복 방지');
            return;
          }
          hasPlayed = true;
          
          console.log('효과음 로드 완료, 재생 시도');
          this.characterAppearSound.play().then(() => {
            console.log('캐릭터 등장 효과음 재생 성공 (로드 후)');
          }).catch(error => {
            // 브라우저 정책으로 재생 실패 시 조용히 처리 (에러 로그만 출력)
            console.log('캐릭터 등장 효과음 재생 불가 (브라우저 자동 재생 정책):', error.name);
            resetFlag(); // 재생 실패 시 플래그 리셋
          });
        };
        
        // canplaythrough만 사용 (더 안정적)
        this.characterAppearSound.addEventListener('canplaythrough', onCanPlay, { once: true });
      } else {
        // 이미 로드되었으면 즉시 재생
        console.log('효과음 이미 로드됨, 즉시 재생 시도');
        this.characterAppearSound.play().then(() => {
          console.log('캐릭터 등장 효과음 재생 성공');
        }).catch(error => {
          // 브라우저 정책으로 재생 실패 시 조용히 처리 (에러 로그만 출력)
          console.log('캐릭터 등장 효과음 재생 불가 (브라우저 자동 재생 정책):', error.name);
          resetFlag(); // 재생 실패 시 플래그 리셋
        });
      }
    };
    
    // 즉시 재생 시도
    attemptPlay();
  }
  
  setupCanvas() {
    // 화면 크기에 맞춰 캔버스 설정 (화면에 보이는 그대로 캡처하기 위해)
    const videoRect = this.video.getBoundingClientRect();
    this.canvas.width = videoRect.width;
    this.canvas.height = videoRect.height;
    
    // 캔버스 스타일 크기도 비디오 표시 크기와 동일하게 설정
    this.canvas.style.width = videoRect.width + 'px';
    this.canvas.style.height = videoRect.height + 'px';
    
    console.log('캔버스 크기 설정:', {
      canvas: { width: this.canvas.width, height: this.canvas.height },
      videoDisplay: { width: videoRect.width, height: videoRect.height },
      videoSource: { width: this.video.videoWidth, height: this.video.videoHeight }
    });
  }
  
  startExperience() {
    // 모바일 환경 감지
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // 4번 캐릭터(회화나무)일 때 바닥 이미지 표시
    const characterId = (window.characterData && window.characterData.id) || this.getCharacterId();
    if (characterId === 4 && this.characterGround) {
      this.characterGround.style.display = 'block';
    }
    
    // 시나리오에 따른 등장 효과 시작
    this.startCharacterScenario();
    
    this.setupEventListeners();
    
    // 모바일에서 버튼 표시 강화
    if (this.isMobile) {
      setTimeout(() => {
        this.ensureControlsVisible();
      }, 5000);
      
      // 추가로 8초 후에도 한 번 더 확인
      setTimeout(() => {
        this.ensureControlsVisible();
      }, 10000);
    }
  }
  
  startCharacterScenario() {
    // 1단계: 빛줄기 등장 (즉시, 디졸브 애니메이션으로)
    this.showLightBeam();
    
    // 2단계: 캐릭터 등장 (1초 후) - 빛줄기 위에서 커지며 등장, 등장 효과음 재생
    setTimeout(() => {
      this.showCharacterFromLight();
    }, 1000);
    
    // 3단계: 캐릭터 등장 완료 후 빛줄기 사라짐 (3초 후) - 디졸브로 사라짐
    setTimeout(() => {
      this.hideLightBeam();
    }, 3000);
    
    // 4단계: 인트로 텍스트와 말풍선 동시 표시 (3.5초 후)
    setTimeout(() => {
      this.showIntroText();
      this.showInitialSpeechBubble();
    }, 3500);
  }
  
  showLightBeam() {
    if (this.lightBeam) {
      this.lightBeam.classList.add('show');
      console.log('빛줄기 등장');
      
      // 파티클 사운드 효과 (실제 구현에서는 사운드 파일 필요)
      this.playParticleSound();
    }
  }
  
  hideLightBeam() {
    if (this.lightBeam) {
      this.lightBeam.classList.add('fade-out');
      console.log('빛줄기 디솔브로 사라짐');
      
      // 1.5초 후 완전히 제거 (디솔브 애니메이션 시간)
      setTimeout(() => {
        if (this.lightBeam.parentNode) {
          this.lightBeam.style.display = 'none';
        }
      }, 1500);
    }
  }
  
  playParticleSound() {
    // 파티클 사운드와 신비로운 벨 사운드 효과
    // 실제 구현에서는 사운드 파일을 로드하여 재생
    console.log('파티클 사운드 재생');
    console.log('신비로운 벨 사운드 재생');
  }
  
  showIntroText() {
    if (this.introText) {
      this.introText.classList.add('show');
    }
  }
  
  showInitialSpeechBubble() {
    // 카메라 화면에서 초기 말풍선 이미지 표시
    const bubble = document.getElementById('camera-speech-bubble');
    const img = document.getElementById('camera-speech-image');
    const charId = (window.characterData && window.characterData.id) || this.getCharacterId();
    if (bubble && img) {
      const src = `./assets/characters/c${charId}_before.png`;
      // 이미지가 로드된 뒤에 강제로 표시 (모바일 표시 안정화)
      const showBubble = () => {
        bubble.classList.add('show');
        bubble.style.display = 'block';
        bubble.style.visibility = 'visible';
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateX(-50%) translateY(0)';
        img.style.display = 'block';
        
        // 이미지 크기 강제 설정 (모바일 대응)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          if (viewportWidth <= 480) {
            // 모바일 작은 화면
            img.style.width = 'min(100vw, 1000px)';
            img.style.maxWidth = '100vw';
            img.style.maxHeight = '90vh';
            img.style.minWidth = '350px';
          } else if (viewportWidth <= 768) {
            // 태블릿
            img.style.width = 'min(98vw, 1200px)';
            img.style.maxWidth = '98vw';
            img.style.maxHeight = '85vh';
            img.style.minWidth = '600px';
          } else {
            // 데스크톱
            img.style.width = 'min(98vw, 1200px)';
            img.style.maxWidth = '98vw';
            img.style.maxHeight = '75vh';
            img.style.minWidth = '500px';
          }
          img.style.height = 'auto';
        } else {
          // 데스크톱
          img.style.width = 'min(98vw, 1200px)';
          img.style.maxWidth = '98vw';
          img.style.maxHeight = '75vh';
          img.style.minWidth = '500px';
          img.style.height = 'auto';
        }
      };
      img.onload = () => {
        showBubble();
        console.log('초기 말풍선 이미지 로드 완료:', src);
      };
      img.onerror = () => { img.style.display = 'none'; };
      img.src = src;
      // 캐시된 이미지 대비
      if (img.complete && img.naturalWidth > 0) {
        showBubble();
      } else {
        // 혹시 onload가 누락되는 브라우저 대비: 700ms 후 재확인
        setTimeout(() => {
          if (img.complete && img.naturalWidth > 0) {
            showBubble();
          }
        }, 700);
      }
      console.log('초기 말풍선 이미지 로드 시작:', src);
    }
  }
  
  getCharacterGreeting() {
    // 캐릭터 데이터에서 등장 인사 가져오기
    const characterData = window.characterData;
    if (characterData && characterData.greeting && characterData.greeting.message) {
      return characterData.greeting.message;
    }
    
    // 폴백: 기본 인사말
    return "함께 사진을 찍어보자!";
  }
  
  showCharacterFromLight() {
    // 캐릭터를 빛줄기와 같은 위치(화면 중앙)에서 등장하도록 설정
    this.character.style.position = 'absolute';
    this.character.style.top = '50%';
    this.character.style.left = '50%';
    this.character.style.display = 'block'; // 보이도록 설정
    this.character.style.visibility = 'visible'; // 보이도록 설정
    this.character.style.zIndex = '15'; // 빛줄기 위에 표시
    this.character.style.transition = 'none'; // 애니메이션과 충돌 방지
    
    // 초기 상태를 CSS로 설정 (인라인 스타일 제거하여 애니메이션이 작동하도록)
    this.character.style.transform = '';
    this.character.style.opacity = '';
    
    // 약간의 지연을 주어 초기 상태가 적용되도록 함
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // 캐릭터 등장 시작 - show 클래스가 애니메이션을 트리거함
        this.character.classList.add('show');
        this.isCharacterVisible = true;
        
        console.log('캐릭터가 빛줄기 가운데에서 커지며 등장');
        
        // 등장 효과음 즉시 재생
        this.playCharacterAppearSound();
        
        // 애니메이션 완료 후 interactive 모드로 전환
        setTimeout(() => {
          // 먼저 중앙 위치 플래그를 설정 (이후 모든 transform 업데이트가 중앙 기준으로 작동하도록)
          this.isCharacterCentered = true;
          
          // show 클래스 제거 전에 모든 스타일을 인라인으로 확실히 설정하여 CSS 전환 효과 방지
          // 애니메이션 완료 상태를 그대로 유지
          this.character.style.top = '50%';
          this.character.style.left = '50%';
          this.character.style.position = 'absolute';
          this.character.style.opacity = '1';
          this.character.style.transform = 'translate(-50%, -50%) scale(1)';
          this.character.style.transition = 'transform 0.3s ease';
          this.character.style.zIndex = '10';
          this.character.style.display = 'block';
          this.character.style.visibility = 'visible';
          
          // characterState를 명확히 초기화
          this.characterState.x = 0;
          this.characterState.y = 0;
          this.characterState.scale = 1;
          this.characterState.rotation = 0;
          
          // show 클래스 제거 및 interactive 클래스 추가
          // requestAnimationFrame을 사용하여 브라우저가 스타일을 먼저 적용하도록 함
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // 클래스 변경 전에 스타일이 확실히 적용되었는지 확인
              this.character.classList.remove('show');
              this.character.classList.add('interactive');
              
              // 추가로 스타일을 다시 설정하여 CSS 전환 효과 완전히 방지
              this.character.style.top = '50%';
              this.character.style.left = '50%';
              this.character.style.opacity = '1';
              this.character.style.transform = 'translate(-50%, -50%) scale(1)';
              this.character.style.transition = 'transform 0.3s ease';
              this.character.style.animation = 'none'; // 애니메이션 완전히 제거
              
              // updateCharacterTransform을 사용하여 일관된 방식으로 적용
              this.updateCharacterTransform();
              
              console.log('캐릭터 등장 완료 - 중앙 위치 유지:', {
                isCharacterCentered: this.isCharacterCentered,
                top: this.character.style.top,
                left: this.character.style.left,
                x: this.characterState.x,
                y: this.characterState.y,
                transform: this.character.style.transform,
                animation: this.character.style.animation
              });

              this.scheduleCharacterGuide(400, 4200);
            });
          });
        }, 2000); // 캐릭터 등장 시간을 2초로 연장
      });
    });
  }
  
  moveCharacterToDefaultPosition() {
    // 캐릭터를 기본 위치로 부드럽게 이동
    // top과 left를 제거하고 transform만 사용하여 위치 이동
    this.character.style.transition = 'transform 1s ease-in-out, opacity 0.3s ease';
    this.character.style.zIndex = '10'; // 기본 z-index로 복원
    
    // 캐릭터 상태 초기화 (말풍선 영역을 피한 위치)
    this.characterState.x = 0;
    this.characterState.y = 0; // 기본 위치는 말풍선 영역 밖
    
    // 중앙에서 시작하여 기본 위치로 이동
    // updateCharacterTransform()을 즉시 호출하여 부드럽게 이동
    this.updateCharacterTransform();
    
    // 이동 완료 후 transition 제거
    setTimeout(() => {
      this.character.style.transition = '';
    }, 1000);
  }
  
  resetCharacterPosition() {
    // 캐릭터를 기본 위치로 리셋 (화면 하단 60% 지점)
    this.character.style.top = '0';
    this.character.style.left = '0';
    this.character.style.transform = 'scale(1)';
    this.character.style.zIndex = '10';
  }
  
  ensureControlsVisible() {
    const controls = document.getElementById('controls');
    const captureBtn = document.getElementById('capture-btn');
    
    if (controls && captureBtn) {
      // 모바일에서 버튼 강제 표시
      controls.style.display = 'flex';
      controls.style.visibility = 'visible';
      controls.style.opacity = '1';
      
      // 하이라이트 제거 (모바일 전체 카메라 배경 유지)
      captureBtn.style.animation = '';
      captureBtn.style.boxShadow = '';
      captureBtn.style.border = '';
      captureBtn.style.transform = '';
      
      // 모바일에서 버튼 위치 강제 조정 (배경 투명 유지)
      if (this.isMobile) {
        controls.style.position = 'fixed';
        controls.style.bottom = '0';
        controls.style.left = '0';
        controls.style.right = '0';
        controls.style.zIndex = '9999';
        controls.style.background = 'transparent';
      }
      
      // 하이라이트 타이머 제거
    }
  }
  
  
  
  setupEventListeners() {
    document.getElementById('capture-btn').addEventListener('click', () => {
      this.capturePhoto();
    });
    
    // 이벤트 위임을 사용하여 동적으로 생성되는 버튼들 처리
    document.addEventListener('click', (e) => {
      if (e.target.id === 'retake-btn' || e.target.closest('#retake-btn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('다시 찍기 버튼 클릭 이벤트 발생 (이벤트 위임)');
        this.retakePhoto();
      } else if (e.target.id === 'save-btn' || e.target.closest('#save-btn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('저장하기 버튼 클릭 이벤트 발생 (이벤트 위임)');
        this.savePhoto();
      }
    });
    
    // 추가적으로 직접 이벤트 리스너도 설정 (이중 보장)
    setTimeout(() => {
      const retakeBtn = document.getElementById('retake-btn');
      if (retakeBtn) {
        retakeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('다시 찍기 버튼 클릭 이벤트 발생 (직접 바인딩)');
          this.retakePhoto();
        });
        console.log('retake-btn 직접 이벤트 리스너 설정 완료');
      } else {
        console.error('retake-btn 요소를 찾을 수 없습니다 (직접 바인딩 시도)');
      }
      
      const saveBtn = document.getElementById('save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('저장하기 버튼 클릭 이벤트 발생 (직접 바인딩)');
          this.savePhoto();
        });
        console.log('save-btn 직접 이벤트 리스너 설정 완료');
      } else {
        console.error('save-btn 요소를 찾을 수 없습니다 (직접 바인딩 시도)');
      }
    }, 100);
    
      // 캐릭터 상호작용 이벤트
      this.setupCharacterInteractions();
      
      // 사용자 상호작용 시 배경음악 재개를 위한 이벤트 리스너
      this.setupResumeMusicOnInteraction();
    
    // 윈도우 리사이즈 시 처리 (슬라이더 제거됨)
    
    // 페이지 가시성 변경 시 배경음악 제어
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 페이지가 숨겨질 때 음악 일시정지
        if (this.backgroundMusic && !this.backgroundMusic.paused) {
          this.wasMusicPlaying = true; // 재생 중이었음을 기록
          this.backgroundMusic.pause();
        } else {
          this.wasMusicPlaying = false;
        }
      } else {
        // 페이지가 다시 보일 때 음악 재생 (원래 재생 중이었던 경우에만)
        if (this.backgroundMusic && this.wasMusicPlaying) {
          // 즉시 재생 시도 (여러 방법으로 시도)
          this.resumeBackgroundMusic();
        }
      }
    });
    
    // pageshow 이벤트도 감지 (백그라운드에서 돌아올 때)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        // 페이지가 백그라운드에서 복원되었을 때
        if (this.backgroundMusic && this.wasMusicPlaying && this.backgroundMusic.paused) {
          this.resumeBackgroundMusic();
        }
      }
    });
    
    // window focus 이벤트도 감지
    window.addEventListener('focus', () => {
      if (this.backgroundMusic && this.wasMusicPlaying && this.backgroundMusic.paused) {
        this.resumeBackgroundMusic();
      }
    });
    
    // 캐릭터 이미지 로드 완료 (슬라이더 제거됨)
  }
  
  setupCharacterInteractions() {
    // 드래그 기능
    this.character.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startDrag(e);
    });
    
    this.character.addEventListener('touchstart', (e) => {
      // 두 손가락이면 피치줌 시작
      if (e.touches.length === 2) {
        // 핀치줌 시작 (영역 체크 완화)
        e.preventDefault();
        e.stopPropagation();
        // 드래그 중이면 먼저 종료
        if (this.characterState.isDragging) {
          this.endDrag();
        }
        this.startPinch(e.touches);
      } else if (e.touches.length === 1 && !this.characterState.isPinching) {
        // 한 손가락이면 드래그 시작
        e.preventDefault();
        e.stopPropagation();
        this.startDrag(e.touches[0]);
      }
    });
    
    // document 레벨에서 두 손가락 터치 처리 (핀치줌 개선)
    document.addEventListener('touchstart', (e) => {
      // 두 손가락 터치면 브라우저 기본 동작 차단
      if (e.touches.length === 2) {
        // 캐릭터 근처에서 핀치줌 시도 중이면 브라우저 기본 동작 차단
        if (this.isNearCharacter(e.touches)) {
          e.preventDefault();
          e.stopPropagation();
          // 드래그 중이면 먼저 종료
          if (this.characterState.isDragging) {
            this.endDrag();
          }
          this.startPinch(e.touches);
        }
      }
    }, { passive: false });
    
    // 성능 최적화: passive 옵션 사용 (스크롤 성능 개선)
    document.addEventListener('mousemove', (e) => {
      if (this.characterState.isDragging && !this.characterState.isPinching) {
        e.preventDefault();
        this.drag(e);
      }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
      // 두 손가락이면 피치줌 처리
      if (e.touches.length === 2) {
        // 핀치줌이 이미 시작되었거나 캐릭터 근처에 있으면 핀치줌 처리
        if (this.characterState.isPinching || this.isNearCharacter(e.touches)) {
          // 피치줌이 아직 시작되지 않았으면 시작
          if (!this.characterState.isPinching) {
            // 드래그 중이면 먼저 종료
            if (this.characterState.isDragging) {
              this.endDrag();
            }
            this.startPinch(e.touches);
          }
          e.preventDefault();
          e.stopPropagation();
          this.handlePinch(e.touches);
        } else {
          // 캐릭터와 멀리 떨어져 있으면 핀치줌 중단
          if (this.characterState.isPinching) {
            this.endPinch();
          }
          // 브라우저의 기본 핀치줌 동작(화면 확대/축소) 방지
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.touches.length === 1 && this.characterState.isDragging && !this.characterState.isPinching) {
        // 한 손가락이면 드래그 처리
        e.preventDefault();
        this.drag(e.touches[0]);
      } else if (e.touches.length === 1 && this.characterState.isPinching) {
        // 핀치줌 중에 한 손가락만 남으면 핀치줌 종료
        e.preventDefault();
        this.endPinch();
      }
    }, { passive: false });
    
    document.addEventListener('mouseup', (e) => {
      if (this.characterState.isDragging) {
        e.preventDefault();
        this.endDrag();
      }
    });
    
    document.addEventListener('touchend', (e) => {
      // 핀치줌 중이고 남은 터치가 2개 미만이면 핀치줌 종료
      if (this.characterState.isPinching && e.touches.length < 2) {
        e.preventDefault();
        e.stopPropagation();
        this.endPinch();
      }
      
      // 드래그 종료
      if (this.characterState.isDragging && e.touches.length === 0) {
        e.preventDefault();
        this.endDrag();
      }
      
      // 모든 터치가 끝났을 때 상태 초기화
      if (e.touches.length === 0) {
        if (this.characterState.isPinching) {
          this.endPinch();
        }
        if (this.characterState.isDragging) {
          this.endDrag();
        }
      }
    }, { passive: false });
    
    // touchcancel 이벤트도 처리 (터치가 취소될 때)
    document.addEventListener('touchcancel', (e) => {
      if (this.characterState.isPinching) {
        this.endPinch();
      }
      if (this.characterState.isDragging) {
        this.endDrag();
      }
    }, { passive: false });
    
    // 마우스 휠 줌 (데스크톱 지원)
    this.character.addEventListener('wheel', (e) => {
      // 캐릭터 위에서 휠 스크롤 시 줌인/줌아웃
      e.preventDefault();
      e.stopPropagation();
      
      // Ctrl 키 또는 Meta 키를 누르고 있으면 줌 (일반 브라우저 동작)
      // 일반 휠 스크롤은 줌으로 처리
      const delta = e.deltaY;
      const zoomFactor = delta > 0 ? 0.9 : 1.1; // 아래로 스크롤하면 축소, 위로 스크롤하면 확대
      
      let newScale = this.characterState.scale * zoomFactor;
      newScale = Math.max(0.5, Math.min(2.0, newScale));
      
      this.characterState.scale = newScale;
      this.updateCharacterTransform();
    }, { passive: false });
    
  }
  
  startDrag(e) {
    this.characterState.isDragging = true;
    this.character.classList.add('dragging');
    
    // 드래그 시작 시 현재 마우스/터치 위치 저장
    this.characterState.dragStart = {
      x: e.clientX,
      y: e.clientY
    };
    
    // 터치 이벤트인 경우 추가 처리
    if (e.touches) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 드래그 시작 시 현재 위치 저장
    this.characterState.startX = this.characterState.x;
    this.characterState.startY = this.characterState.y;
  }
  
  drag(e) {
    if (!this.characterState.isDragging || this.characterState.isPinching) return;
    
    // 터치 이벤트인 경우 추가 처리
    if (e.touches) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 마우스/터치 위치에서 드래그 시작 위치를 뺀 변화량 계산
    const deltaX = e.clientX - this.characterState.dragStart.x;
    const deltaY = e.clientY - this.characterState.dragStart.y;
    
    // 드래그 시작 위치에서의 변화량을 적용
    const newX = this.characterState.startX + deltaX;
    const newY = this.characterState.startY + deltaY;
    
    // 중앙 모드와 기본 위치 모드에 따라 경계 제한이 다름
    if (this.isCharacterCentered) {
      // 중앙 모드: 중앙 기준 상대 위치 제한
      const maxX = window.innerWidth / 2 - 100; // 화면 중앙에서 좌우 최대 이동 거리
      const maxY = window.innerHeight / 2 - 150; // 화면 중앙에서 상하 최대 이동 거리
      const minY = -window.innerHeight / 2 + 150; // 말풍선 영역 차단 (상단 150px)
      
      // X축 제한 (중앙 기준)
      this.characterState.x = Math.max(-maxX, Math.min(newX, maxX));
      
      // Y축 제한 - 말풍선 영역으로 이동 완전 차단
      this.characterState.y = Math.max(minY, Math.min(newY, maxY));
    } else {
      // 기본 위치 모드: 화면 하단 기준 위치 제한
      const maxX = window.innerWidth - 200; // 캐릭터 최대 너비
      const maxY = window.innerHeight - 300; // 캐릭터 최대 높이
      
      // 말풍선 영역 완전 차단 (상단 150px 영역)
      const speechBubbleHeight = 150;
      const minY = -window.innerHeight/2 + speechBubbleHeight;
      
      // X축 제한
      this.characterState.x = Math.max(-window.innerWidth/2 + 100, Math.min(newX, maxX));
      
      // Y축 제한 - 말풍선 영역으로 이동 완전 차단
      this.characterState.y = Math.max(minY, Math.min(newY, maxY));
      
      // 추가 검증: 말풍선 영역으로 이동 시도 시 강제로 제한
      if (this.characterState.y < minY) {
        this.characterState.y = minY;
      }
    }
    
    // 성능 최적화: requestAnimationFrame을 사용하여 배치 업데이트
    this.needsTransformUpdate = true;
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        this.updateCharacterTransform();
        this.animationFrameId = null;
        this.needsTransformUpdate = false;
      });
    }
  }
  
  endDrag() {
    this.characterState.isDragging = false;
    this.character.classList.remove('dragging');
    
    // 드래그 종료 시 남은 업데이트가 있으면 즉시 처리
    if (this.needsTransformUpdate && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.updateCharacterTransform();
      this.needsTransformUpdate = false;
    }
  }
  
  // 두 점 사이의 거리 계산
  getDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // 터치 위치가 캐릭터 영역 내에 있는지 확인
  isTouchInCharacterArea(touch) {
    if (!this.character || !touch) return false;
    
    const characterRect = this.character.getBoundingClientRect();
    const touchX = touch.clientX;
    const touchY = touch.clientY;
    
    return (
      touchX >= characterRect.left &&
      touchX <= characterRect.right &&
      touchY >= characterRect.top &&
      touchY <= characterRect.bottom
    );
  }
  
  // 두 터치가 모두 캐릭터 영역 내에 있는지 확인
  areTouchesInCharacterArea(touches) {
    if (!touches || touches.length < 2) return false;
    return this.isTouchInCharacterArea(touches[0]) && this.isTouchInCharacterArea(touches[1]);
  }
  
  // 터치가 캐릭터 근처에 있는지 확인 (확장된 영역, 여유 공간 포함)
  isNearCharacter(touches) {
    if (!touches || touches.length < 2 || !this.character) return false;
    
    const characterRect = this.character.getBoundingClientRect();
    // 캐릭터 영역을 1.5배 확장하여 더 넓은 범위에서 핀치줌 허용
    const padding = Math.max(characterRect.width, characterRect.height) * 0.5;
    const expandedLeft = characterRect.left - padding;
    const expandedRight = characterRect.right + padding;
    const expandedTop = characterRect.top - padding;
    const expandedBottom = characterRect.bottom + padding;
    
    // 두 터치 중 하나라도 확장된 영역 내에 있으면 true
    const touch1InArea = touches[0].clientX >= expandedLeft && touches[0].clientX <= expandedRight &&
                         touches[0].clientY >= expandedTop && touches[0].clientY <= expandedBottom;
    const touch2InArea = touches[1].clientX >= expandedLeft && touches[1].clientX <= expandedRight &&
                         touches[1].clientY >= expandedTop && touches[1].clientY <= expandedBottom;
    
    // 두 터치 중 하나라도 확장된 영역 내에 있거나, 두 터치의 중심점이 확장된 영역 내에 있으면 허용
    if (touch1InArea || touch2InArea) return true;
    
    // 두 터치의 중심점 계산
    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;
    
    return centerX >= expandedLeft && centerX <= expandedRight &&
           centerY >= expandedTop && centerY <= expandedBottom;
  }
  
  startPinch(touches) {
    if (!touches || touches.length !== 2) return;
    
    // 드래그 중지
    if (this.characterState.isDragging) {
      this.characterState.isDragging = false;
      this.character.classList.remove('dragging');
    }
    
    // 피치줌 시작
    const distance = this.getDistance(touches[0], touches[1]);
    if (distance < 10) return; // 거리가 너무 작으면 시작하지 않음 (10px 이상)
    
    // 핀치줌 상태 초기화
    this.characterState.isPinching = true;
    this.characterState.initialPinchDistance = distance;
    this.characterState.initialPinchScale = this.characterState.scale || 1;
  }
  
  handlePinch(touches) {
    if (touches.length !== 2) {
      if (this.characterState.isPinching) {
        this.endPinch();
      }
      return;
    }
    
    // 피치줌이 시작되지 않았으면 시작
    if (!this.characterState.isPinching) {
      this.startPinch(touches);
      // 시작 후에도 거리 계산이 유효한지 확인
      if (!this.characterState.isPinching) {
        return;
      }
    }
    
    // 현재 두 손가락 사이의 거리 계산
    const currentDistance = this.getDistance(touches[0], touches[1]);
    
    // 초기 거리가 유효하지 않으면 재시작
    if (!this.characterState.initialPinchDistance || this.characterState.initialPinchDistance < 10) {
      this.startPinch(touches);
      if (!this.characterState.isPinching) {
        return;
      }
    }
    
    // 거리 비율 계산 (안정성을 위해 최소값 체크)
    const distanceRatio = currentDistance / this.characterState.initialPinchDistance;
    
    // 비율이 너무 극단적이면 제한 (0.5 ~ 2.0 범위)
    const clampedRatio = Math.max(0.5, Math.min(2.0, distanceRatio));
    
    // 초기 scale에 비율을 곱하여 새로운 scale 계산
    const baseScale = this.characterState.initialPinchScale || 1;
    let newScale = baseScale * clampedRatio;
    
    // scale 제한 (0.5 ~ 2.0)
    newScale = Math.max(0.5, Math.min(2.0, newScale));
    
    // scale 업데이트
    this.characterState.scale = newScale;
    
    // 즉시 업데이트 (성능을 위해 requestAnimationFrame 사용)
    this.needsTransformUpdate = true;
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(() => {
        this.updateCharacterTransform();
        this.animationFrameId = null;
        this.needsTransformUpdate = false;
      });
    }
  }
  
  endPinch() {
    this.characterState.isPinching = false;
    this.characterState.initialPinchDistance = 0;
    
    // 피치줌 종료 시 남은 업데이트가 있으면 즉시 처리
    if (this.needsTransformUpdate && this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
      this.updateCharacterTransform();
      this.needsTransformUpdate = false;
    }
  }
  
  updateCharacterTransform() {
    // scale 값 제한 (0.5 ~ 3.0)
    this.characterState.scale = Math.max(0.5, Math.min(2.0, this.characterState.scale));
    
    // isCharacterCentered 플래그를 최우선으로 확인 (가장 확실한 방법)
    const isCentered = this.isCharacterCentered;
    
    // 성능 최적화: 불필요한 스타일 업데이트 방지
    const currentTop = this.character.style.top;
    const currentLeft = this.character.style.left;
    
    let transform;
    
    if (isCentered) {
      // 중앙 기준 transform (드래그는 중앙에서의 상대적 위치)
      // top: 50%, left: 50%를 확실히 유지 (값이 다를 때만 업데이트)
      if (currentTop !== '50%') {
        this.character.style.top = '50%';
      }
      if (currentLeft !== '50%') {
        this.character.style.left = '50%';
      }
      
      // 성능 최적화: transform 문자열 계산 최적화
      const x = this.characterState.x;
      const y = this.characterState.y;
      const scale = this.characterState.scale;
      const scaleX = scale * this.characterState.flipX;
      const rotation = this.characterState.rotation;
      
      // GPU 가속을 위해 translateZ(0) 추가
      transform = `translate3d(calc(-50% + ${x}px),calc(-50% + ${y}px),0) scale(${scaleX},${scale}) rotate(${rotation}deg)`;
    } else {
      // 기본 위치 모드 (화면 중앙 하단)
      // top, left를 초기화 (기본 위치 모드에서는 사용하지 않음)
      if (currentTop !== '0') {
        this.character.style.top = '0';
      }
      if (currentLeft !== '0') {
        this.character.style.left = '0';
      }
      
      const baseX = window.innerWidth / 2 - 100; // 캐릭터 너비의 절반
      const baseY = window.innerHeight * 0.6 - 150; // 화면 하단 60% 지점
      
      // 최종 위치 계산
      const finalX = baseX + this.characterState.x;
      let finalY = baseY + this.characterState.y;
      
      // 말풍선 영역 완전 차단 (상단 150px 영역)
      const speechBubbleHeight = 150;
      const minY = -window.innerHeight/2 + speechBubbleHeight;
      const absoluteMinY = baseY + minY;
      
      // 말풍선 영역으로 이동 시도 시 강제로 제한
      if (finalY < absoluteMinY) {
        finalY = absoluteMinY;
        // 상태도 업데이트하여 다음 드래그에서 올바른 위치 유지
        this.characterState.y = minY;
      }
      
      // 성능 최적화: transform 문자열 계산 최적화
      const scale = this.characterState.scale;
      const scaleX = scale * this.characterState.flipX;
      const rotation = this.characterState.rotation;
      
      // GPU 가속을 위해 translate3d 사용
      transform = `translate3d(${finalX}px,${finalY}px,0) scale(${scaleX},${scale}) rotate(${rotation}deg)`;
    }
    
    // 성능 최적화: transform이 실제로 변경되었을 때만 DOM 업데이트
    const currentTransform = this.character.style.transform;
    if (currentTransform !== transform) {
      this.character.style.transform = transform;
    }
    
    // 캐릭터가 보이도록 보장 (값이 다를 때만 업데이트)
    if (this.character.style.display !== 'block') {
      this.character.style.display = 'block';
    }
    if (this.character.style.visibility !== 'visible') {
      this.character.style.visibility = 'visible';
    }
    if (this.character.style.opacity !== '1') {
      this.character.style.opacity = '1';
    }
  }
  
  
  capturePhoto() {
    if (!this.isCharacterVisible) {
      alert('캐릭터가 완전히 등장한 후 사진을 찍어주세요!');
      return;
    }
    
    // 말풍선은 촬영하지 않고, 바로 촬영 진행
    this.performCapture();
  }
  
  performCapture() {
    // 비디오의 실제 표시 크기와 위치 저장 (촬영된 이미지 표시에 사용)
    const videoRect = this.video.getBoundingClientRect();
    this.videoDisplayInfo = {
      left: videoRect.left,
      top: videoRect.top,
      width: videoRect.width,
      height: videoRect.height
    };
    
    // 고해상도 캡처를 위한 스케일 팩터 계산
    // devicePixelRatio를 사용하되, 최소 해상도 보장 (최소 1920x1080)
    const devicePixelRatio = window.devicePixelRatio || 1;
    const minWidth = 1920;
    const minHeight = 1080;
    const scaleFactor = Math.max(
      devicePixelRatio * 2, // 기본적으로 2배 스케일
      minWidth / videoRect.width,
      minHeight / videoRect.height
    );
    
    // 캔버스 크기를 고해상도로 설정
    this.canvas.width = Math.round(videoRect.width * scaleFactor);
    this.canvas.height = Math.round(videoRect.height * scaleFactor);
    
    // 스케일 팩터 저장 (나중에 그리기 시 사용)
    this.captureScaleFactor = scaleFactor;
    
    // 비디오를 화면에 보이는 그대로 그리기 (CSS object-fit: cover와 동일하게)
    const vW = this.video.videoWidth || this.canvas.width;
    const vH = this.video.videoHeight || this.canvas.height;
    const viewW = videoRect.width || window.innerWidth;
    const viewH = videoRect.height || window.innerHeight;
    const videoAR = vW / vH;
    const viewAR = viewW / viewH;
    
    // 후면 카메라만 사용하므로 반전 없음
    const isFrontCamera = false;
    
    // 비디오 크롭 정보 계산 (CSS object-fit: cover 방식)
    let sx = 0, sy = 0, sW = vW, sH = vH;
    if (videoAR > viewAR) {
      // 비디오가 더 넓음 → 좌우 크롭
      sW = Math.round(vH * viewAR);
      sx = Math.round((vW - sW) / 2);
    } else if (videoAR < viewAR) {
      // 비디오가 더 좁음 → 상하 크롭
      sH = Math.round(vW / viewAR);
      sy = Math.round((vH - sH) / 2);
    }
    
    // 비디오 그리기 (고해상도로)
    if (isFrontCamera) {
      // 전면 카메라일 때 좌우 반전 적용
      this.ctx.save();
      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);
      // 반전된 상태에서 비디오를 정상 위치에 그리기
      this.ctx.drawImage(this.video, sx, sy, sW, sH, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    } else {
      // 후면 카메라일 때는 정상적으로 그리기
      this.ctx.drawImage(this.video, sx, sy, sW, sH, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 고해상도 렌더링을 위한 이미지 스무딩 설정
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    // 빛줄기가 보이는 경우 캔버스에 그리기
    if (this.lightBeam && this.lightBeam.style.display !== 'none') {
      const lightImg = this.lightBeam.querySelector('img');
      if (lightImg && lightImg.complete && lightImg.naturalWidth > 0) {
        const lightRect = this.lightBeam.getBoundingClientRect();
        
        // 빛줄기 위치를 고해상도 캔버스 좌표로 변환
        const scaleFactor = this.captureScaleFactor || 1;
        const lightX = (lightRect.left - videoRect.left) * scaleFactor;
        const lightY = (lightRect.top - videoRect.top) * scaleFactor;
        const lightWidth = lightRect.width * scaleFactor;
        const lightHeight = lightRect.height * scaleFactor;
        
        // 빛줄기 그리기 (캐릭터 뒤에)
        this.ctx.drawImage(lightImg, lightX, lightY, lightWidth, lightHeight);
      }
    }
    
    // 4번 캐릭터의 바닥 이미지를 캔버스에 그리기 (캐릭터보다 먼저, z-index가 낮으므로)
    if (this.characterGround && this.characterGround.style.display !== 'none') {
      const groundImg = this.characterGround.querySelector('img');
      if (groundImg && groundImg.complete && groundImg.naturalWidth > 0) {
        const groundRect = this.characterGround.getBoundingClientRect();
        
        // 바닥 이미지 위치를 고해상도 캔버스 좌표로 변환
        const scaleFactor = this.captureScaleFactor || 1;
        const groundX = (groundRect.left - videoRect.left) * scaleFactor;
        const groundY = (groundRect.top - videoRect.top) * scaleFactor;
        const groundWidth = groundRect.width * scaleFactor;
        const groundHeight = groundRect.height * scaleFactor;
        
        // 바닥 이미지 그리기 (캐릭터 뒤에)
        this.ctx.drawImage(groundImg, groundX, groundY, groundWidth, groundHeight);
      }
    }
    
    // 캐릭터 이미지를 캔버스에 그리기 (화면에 보이는 그대로)
    const characterImg = this.character ? this.character.querySelector('img') : null;
    if (characterImg && characterImg.complete && characterImg.naturalWidth > 0) {
      // 컨테이너와 이미지 요소의 실제 렌더링 위치 모두 확인
      const characterRect = this.character.getBoundingClientRect();
      const imageRect = characterImg.getBoundingClientRect();
      
      // 캐릭터가 화면에 보이는지 확인
      if (characterRect.width > 0 && characterRect.height > 0) {
        // 이미지 원본 비율 계산
        const naturalWidth = characterImg.naturalWidth;
        const naturalHeight = characterImg.naturalHeight;
        const imageAspectRatio = naturalWidth / naturalHeight;
        
        // 화면에 표시된 크기 (컨테이너 크기)
        const containerWidth = characterRect.width;
        const containerHeight = characterRect.height;
        const containerAspectRatio = containerWidth / containerHeight;
        
        // 실제 이미지 렌더링 크기 (object-fit: contain으로 인해 컨테이너보다 작을 수 있음)
        const imageDisplayWidth = imageRect.width;
        const imageDisplayHeight = imageRect.height;
        
        // object-fit: contain으로 인한 실제 렌더링 크기 계산
        let drawWidth = imageDisplayWidth;
        let drawHeight = imageDisplayHeight;
        
        // 원본 비율을 유지하면서 계산된 크기와 실제 렌더링 크기 비교
        let expectedWidth = containerWidth;
        let expectedHeight = containerHeight;
        
        if (Math.abs(imageAspectRatio - containerAspectRatio) > 0.01) {
          if (imageAspectRatio > containerAspectRatio) {
            // 이미지가 더 넓음 → 높이를 기준으로 맞춤
            expectedWidth = containerHeight * imageAspectRatio;
            expectedHeight = containerHeight;
          } else {
            // 이미지가 더 높음 → 너비를 기준으로 맞춤
            expectedWidth = containerWidth;
            expectedHeight = containerWidth / imageAspectRatio;
          }
        }
        
        // 실제 렌더링된 크기 사용 (브라우저가 계산한 정확한 크기)
        drawWidth = imageDisplayWidth;
        drawHeight = imageDisplayHeight;
        
        // 실제 이미지의 중심점 계산 (imageRect 사용)
        const imageCenterX = imageRect.left + imageDisplayWidth / 2;
        const imageCenterY = imageRect.top + imageDisplayHeight / 2;
        
        // 고해상도 스케일 팩터 적용
        const scaleFactor = this.captureScaleFactor || 1;
        
        // 이미지 중심점을 고해상도 캔버스 좌표로 변환
        const canvasImageCenterX = (imageCenterX - videoRect.left) * scaleFactor;
        const canvasImageCenterY = (imageCenterY - videoRect.top) * scaleFactor;
        
        // 고해상도로 그릴 크기 계산
        const scaledDrawWidth = drawWidth * scaleFactor;
        const scaledDrawHeight = drawHeight * scaleFactor;
        
        // 캔버스 상태 저장
        this.ctx.save();
        
        // 실제 이미지 중심점으로 이동
        this.ctx.translate(canvasImageCenterX, canvasImageCenterY);
        
        // 회전 적용
        this.ctx.rotate((this.characterState.rotation * Math.PI) / 180);
        
        // 좌우반전 적용
        this.ctx.scale(this.characterState.flipX, 1);
        
        // 원본 이미지를 원본 비율을 유지하면서 고해상도로 그리기
        // drawImage: (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
        this.ctx.drawImage(
          characterImg,
          0, 0, naturalWidth, naturalHeight, // 원본 이미지 전체
          -scaledDrawWidth / 2, -scaledDrawHeight / 2, scaledDrawWidth, scaledDrawHeight // 고해상도 크기로 그리기
        );
        
        // 캔버스 상태 복원
        this.ctx.restore();
        
        console.log('캐릭터 캔버스 그리기 성공 (실제 렌더링 위치 사용):', {
          containerRect: { left: characterRect.left, top: characterRect.top, width: containerWidth, height: containerHeight },
          imageRect: { left: imageRect.left, top: imageRect.top, width: imageDisplayWidth, height: imageDisplayHeight },
          videoRect: { left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height },
          canvas: { x: canvasImageCenterX, y: canvasImageCenterY, w: drawWidth, h: drawHeight },
          imageAspectRatio: imageAspectRatio,
          containerAspectRatio: containerAspectRatio,
          naturalSize: { width: naturalWidth, height: naturalHeight },
          canvasSize: { width: this.canvas.width, height: this.canvas.height },
          transform: {
            rotation: this.characterState.rotation,
            flipX: this.characterState.flipX,
            scale: this.characterState.scale
          }
        });
      } else {
        console.warn('캐릭터가 화면에 보이지 않습니다:', {
          characterRect: characterRect,
          display: this.character.style.display,
          visibility: this.character.style.visibility
        });
      }
    } else {
      console.error('캐릭터 이미지를 찾을 수 없거나 로드되지 않았습니다:', {
        character: this.character ? '존재' : '없음',
        characterImg: characterImg ? '존재' : '없음',
        complete: characterImg ? characterImg.complete : false,
        naturalWidth: characterImg ? characterImg.naturalWidth : 0
      });
    }
    
    // 말풍선은 촬영 이미지에 포함하지 않음 (캐릭터만 포함)
    
    // 장소 정보 텍스트 추가
    this.addLocationText();
    
    // 베이스 캡처 이미지를 저장 (후처리 합성에 사용)
    this.capturedBaseDataURL = this.canvas.toDataURL('image/png');
    this.capturedBaseImage = new Image();
    this.capturedBaseImage.src = this.capturedBaseDataURL;
    this.capturedImageData = this.capturedBaseDataURL;
    this.capturedPhoto.src = this.capturedBaseDataURL;
    
    console.log('캡처된 이미지 데이터:', this.capturedImageData ? '존재함' : '없음');
    console.log('캡처된 사진 요소:', this.capturedPhoto);
    console.log('사진 결과 요소:', this.photoResult);
    
    // 사진 결과 화면 표시
    this.showPhotoResult();
  }
  
  addLocationText() {
    const locationInfo = document.querySelector('.location-info');
    if (locationInfo) {
      const locationText = locationInfo.textContent;
      const scaleFactor = this.captureScaleFactor || 1;
      
      // 고해상도에 맞춰 텍스트 크기와 위치 조정
      const padding = 10 * scaleFactor;
      const boxWidth = 300 * scaleFactor;
      const boxHeight = 40 * scaleFactor;
      const fontSize = 16 * scaleFactor;
      const textX = 20 * scaleFactor;
      const textY = 35 * scaleFactor;
      
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(padding, padding, boxWidth, boxHeight);
      
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${fontSize}px Noto Sans KR`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(locationText, textX, textY);
    }
  }
  
  showPhotoResult() {
    console.log('사진 결과 화면 표시 중...');
    
    this.hideCharacterGuide();
    
    // 원래 화면의 요소들 숨기기 (캐릭터, 컨트롤 등)
    this.hideOriginalElements();
    
    // 비디오 스트림만 숨기기 (촬영된 이미지는 보여야 함)
    if (this.video) {
      this.video.style.display = 'none';
    }
    if (this.canvas) {
      this.canvas.style.display = 'none';
    }
    
    // 사진 결과 화면 강제 표시 (투명 배경)
    if (this.photoResult) {
      this.photoResult.style.display = 'block';
      this.photoResult.style.visibility = 'visible';
      this.photoResult.style.opacity = '1';
      this.photoResult.style.zIndex = '99999';
      this.photoResult.style.position = 'fixed';
      this.photoResult.style.top = '0';
      this.photoResult.style.left = '0';
      this.photoResult.style.width = '100vw';
      this.photoResult.style.height = '100vh';
      this.photoResult.style.background = 'transparent'; // 배경 투명하게
      this.photoResult.classList.add('show');
    }
    
    // 촬영된 이미지 표시 (비디오와 동일한 크기와 위치로)
    if (this.capturedPhoto && this.videoDisplayInfo) {
      this.capturedPhoto.style.display = 'block';
      this.capturedPhoto.style.visibility = 'visible';
      this.capturedPhoto.style.opacity = '1';
      this.capturedPhoto.style.position = 'fixed';
      this.capturedPhoto.style.left = this.videoDisplayInfo.left + 'px';
      this.capturedPhoto.style.top = this.videoDisplayInfo.top + 'px';
      this.capturedPhoto.style.width = this.videoDisplayInfo.width + 'px';
      this.capturedPhoto.style.height = this.videoDisplayInfo.height + 'px';
      this.capturedPhoto.style.objectFit = 'cover';
      this.capturedPhoto.style.objectPosition = 'center';
      this.capturedPhoto.style.zIndex = '1';
    } else if (this.capturedPhoto) {
      // videoDisplayInfo가 없는 경우 기본값 사용
      this.capturedPhoto.style.display = 'block';
      this.capturedPhoto.style.visibility = 'visible';
      this.capturedPhoto.style.opacity = '1';
      this.capturedPhoto.style.width = '100%';
      this.capturedPhoto.style.height = '100%';
      this.capturedPhoto.style.objectFit = 'cover';
    }
    
    // 액션 버튼들 표시 (다시 찍기, 저장하기)
    const photoActions = document.getElementById('photo-actions');
    if (photoActions) {
      photoActions.style.display = 'flex';
      photoActions.style.visibility = 'visible';
      photoActions.style.opacity = '1';
      
      // 모바일에서 버튼 이미지 크기 강제 적용
      const actionIcons = photoActions.querySelectorAll('.action-icon');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const viewportWidth = window.innerWidth;
      
      actionIcons.forEach(icon => {
        if (isMobile) {
          if (viewportWidth <= 480) {
            // 작은 모바일
            icon.style.maxWidth = '110px';
            icon.style.maxHeight = '44px';
            icon.style.width = '110px';
            icon.style.height = '44px';
          } else if (viewportWidth <= 768) {
            // 태블릿
            icon.style.maxWidth = '120px';
            icon.style.maxHeight = '48px';
            icon.style.width = '120px';
            icon.style.height = '48px';
          }
        }
      });
    }
    
    // 사진 컨트롤 버튼들 표시 (저장, 공유 등)
    const photoControls = document.getElementById('photo-controls');
    if (photoControls) {
      photoControls.style.display = 'flex';
      photoControls.style.visibility = 'visible';
      photoControls.style.opacity = '1';
    }
    
    // 말풍선 표시 (애니메이션 없이)
    this.showSpeechBubble();
    
    console.log('사진 결과 화면 표시 완료');
  }
  
  showSpeechBubble() {
    // 카메라 화면 말풍선 숨기기
    const cameraSpeechBubble = document.getElementById('camera-speech-bubble');
    if (cameraSpeechBubble) {
      cameraSpeechBubble.classList.remove('show');
      cameraSpeechBubble.style.display = 'none';
    }

    // 사진 결과 화면 말풍선 이미지 표시 (애니메이션 없이)
    const bubble = document.getElementById('speech-bubble');
    const img = document.getElementById('result-speech-image');
    const charId = (window.characterData && window.characterData.id) || this.getCharacterId();
    if (bubble && img) {
      const src = `./assets/characters/c${charId}_after.png`;
      
      // 애니메이션 제거
      bubble.style.animation = 'none';
      bubble.style.transition = 'none';
      
      // 이미지 크기 강제 설정 (모바일 대응)
      const setImageSize = () => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const viewportWidth = window.innerWidth;
        
        img.style.display = 'block';
        img.style.animation = 'none'; // 이미지 애니메이션도 제거
        
        if (isMobile) {
          if (viewportWidth <= 480) {
            // 모바일 작은 화면
            img.style.width = 'min(100vw, 1000px)';
            img.style.maxWidth = '100vw';
            img.style.maxHeight = '90vh';
            img.style.minWidth = '350px';
          } else if (viewportWidth <= 768) {
            // 태블릿
            img.style.width = 'min(98vw, 1200px)';
            img.style.maxWidth = '98vw';
            img.style.maxHeight = '85vh';
            img.style.minWidth = '600px';
          } else {
            // 데스크톱
            img.style.width = 'min(98vw, 1200px)';
            img.style.maxWidth = '98vw';
            img.style.maxHeight = '75vh';
            img.style.minWidth = '500px';
          }
          img.style.height = 'auto';
        } else {
          // 데스크톱
          img.style.width = 'min(98vw, 1200px)';
          img.style.maxWidth = '98vw';
          img.style.maxHeight = '75vh';
          img.style.minWidth = '500px';
          img.style.height = 'auto';
        }
      };
      
      img.onload = () => {
        setImageSize();
        // 애니메이션 없이 즉시 표시
        bubble.style.display = 'block';
        bubble.style.visibility = 'visible';
        bubble.style.opacity = '1';
        bubble.style.transform = 'translateX(-50%) translateY(0)'; // 애니메이션 없이 직접 위치 지정
        bubble.classList.remove('show'); // show 클래스는 애니메이션을 트리거할 수 있으므로 제거
        console.log('촬영 후 말풍선 이미지 로드 완료:', src);
      };
      img.onerror = () => { 
        console.error('촬영 후 말풍선 이미지 로드 실패:', src);
        img.style.display = 'none'; 
      };
      img.src = src;
      // 로드 이벤트 누락 대비
      setTimeout(() => {
        if (img.complete && img.naturalWidth > 0) {
          setImageSize();
          bubble.style.display = 'block';
          bubble.style.visibility = 'visible';
          bubble.style.opacity = '1';
          bubble.style.transform = 'translateX(-50%) translateY(0)';
          bubble.classList.remove('show');
        }
      }, 500);
      console.log('촬영 후 말풍선 이미지 로드 시작:', src);
    }
  }

  // 촬영 결과에 말풍선 이미지를 포함하여 최종 합성
  composeResultWithBubble() {
    try {
      if (!this.capturedBaseImage) return;
      const bubbleImg = document.getElementById('result-speech-image');
      const bubble = document.getElementById('speech-bubble');
      const videoRect = this.video.getBoundingClientRect();
      if (!bubbleImg || !bubble || !videoRect.width || !videoRect.height) return;

      // 버블 실제 렌더링 크기/위치 읽기
      const bRect = bubbleImg.getBoundingClientRect();
      const scaleX = this.canvas.width / videoRect.width;
      const scaleY = this.canvas.height / videoRect.height;

      const bx = (bRect.left - videoRect.left) * scaleX;
      const by = (bRect.top - videoRect.top) * scaleY;
      const bw = bRect.width * scaleX;
      const bh = bRect.height * scaleY;

      // 오프스크린 캔버스에서 합성
      const off = document.createElement('canvas');
      off.width = this.canvas.width;
      off.height = this.canvas.height;
      const octx = off.getContext('2d');
      octx.drawImage(this.capturedBaseImage, 0, 0, off.width, off.height);
      octx.drawImage(bubbleImg, bx, by, bw, bh);

      const finalData = off.toDataURL('image/png');
      this.capturedImageData = finalData;
      this.capturedPhoto.src = finalData;
    } catch (e) {
      console.warn('합성 중 오류:', e);
    }
  }
  
  getCharacterPhotoMessage() {
    // 캐릭터 데이터에서 photoGuidance 가져오기
    const characterData = window.characterData;
    if (characterData && characterData.photoGuidance) {
      return characterData.photoGuidance;
    }
    
    // 폴백: 기본 메시지
    return "이곳에서 만나게 되어 기쁘네.";
  }
  
  getCharacterLocation() {
    // 캐릭터 데이터에서 location 가져오기
    const characterData = window.characterData;
    if (characterData && characterData.location) {
      return characterData.location;
    }
    
    // 폴백: 기본 위치
    return "한국의 아름다운 곳";
  }
  
  getCharacterId() {
    // URL 파라미터나 캐릭터 데이터에서 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('char')) || 1;
  }
  
  hideOriginalElements() {
    // 원래 화면의 요소들 숨기기
    this.hideCharacterGuide();
    const controls = document.getElementById('controls');
    const character = document.getElementById('character');
    const locationInfo = document.querySelector('.location-info');
    const introText = document.getElementById('intro-text');
    
    if (controls) {
      controls.style.display = 'none';
    }
    if (character) {
      character.style.display = 'none';
    }
    if (locationInfo) {
      locationInfo.style.display = 'none';
    }
    if (introText) {
      introText.style.display = 'none';
    }
  }
  
  showOriginalElements() {
    // 원래 화면의 요소들 다시 표시
    const controls = document.getElementById('controls');
    const character = document.getElementById('character');
    const locationInfo = document.querySelector('.location-info');
    const introText = document.getElementById('intro-text');
    const cameraBubble = document.getElementById('camera-speech-bubble');
    const resultBubble = document.getElementById('speech-bubble');
    
    if (controls) {
      controls.style.display = 'flex';
    }
    if (character) {
      character.style.display = 'block';
    }
    if (locationInfo) {
      locationInfo.style.display = 'flex';
    }
    if (introText) {
      introText.style.display = 'block';
    }

    // 결과 말풍선은 숨기고, 카메라 말풍선은 다시 표시
    if (resultBubble) {
      resultBubble.classList.remove('show');
    }
    if (cameraBubble) {
      cameraBubble.classList.remove('show');
    }
    
    // 말풍선을 _before.png로 복원
    const cameraSpeechImage = document.getElementById('camera-speech-image');
    if (cameraSpeechImage) {
      const charId = (window.characterData && window.characterData.id) || this.getCharacterId();
      const beforeSrc = `./assets/characters/c${charId}_before.png`;
      // 현재 _after.png인 경우 _before.png로 변경
      if (cameraSpeechImage.src.includes('_after.png')) {
        cameraSpeechImage.src = beforeSrc + '?t=' + Date.now();
      }
    }
    
    // 이미지가 다시 로드되며 show 시점을 onload로 맞추기 위해 재호출
    this.showInitialSpeechBubble();
    
    this.scheduleCharacterGuide(500, 4200);
  }
  
  ensurePhotoControlsVisible() {
    const photoControls = document.getElementById('photo-controls');
    const saveBtn = document.getElementById('save-btn');
    
    if (photoControls && saveBtn) {
      // 사진 컨트롤 강제 표시
      photoControls.style.display = 'flex';
      photoControls.style.visibility = 'visible';
      photoControls.style.opacity = '1';
      photoControls.style.position = 'fixed';
      photoControls.style.bottom = '0';
      photoControls.style.left = '0';
      photoControls.style.right = '0';
      photoControls.style.zIndex = '100000';
      
      // 저장 버튼 강조
      saveBtn.style.animation = 'pulse 1.5s infinite';
      saveBtn.style.boxShadow = '0 0 30px rgba(40, 167, 69, 1)';
      saveBtn.style.border = '3px solid #ffc107';
      saveBtn.style.transform = 'scale(1.1)';
      
      // 8초 후 하이라이트 제거
      setTimeout(() => {
        saveBtn.style.animation = '';
        saveBtn.style.boxShadow = '';
        saveBtn.style.border = '';
        saveBtn.style.transform = '';
      }, 8000);
      
    }
  }
  
  forceShowSaveButton() {
    console.log('강제로 저장 버튼 표시 중...');
    
    // 원래 화면의 요소들 숨기기
    this.hideOriginalElements();
    
    // 사진 결과 화면 강제 표시
    if (this.photoResult) {
      this.photoResult.style.display = 'block';
      this.photoResult.style.visibility = 'visible';
      this.photoResult.style.opacity = '1';
      this.photoResult.style.zIndex = '99999';
      this.photoResult.style.position = 'fixed';
      this.photoResult.style.top = '0';
      this.photoResult.style.left = '0';
      this.photoResult.style.width = '100vw';
      this.photoResult.style.height = '100vh';
      this.photoResult.style.background = 'rgba(0, 0, 0, 0.95)';
      this.photoResult.classList.add('show');
    }
    
    // 사진 컨트롤 강제 표시
    const photoControls = document.getElementById('photo-controls');
    if (photoControls) {
      photoControls.style.display = 'flex';
      photoControls.style.visibility = 'visible';
      photoControls.style.opacity = '1';
      photoControls.style.position = 'fixed';
      photoControls.style.bottom = '0';
      photoControls.style.left = '0';
      photoControls.style.right = '0';
      photoControls.style.zIndex = '100000';
      photoControls.style.background = 'rgba(0, 0, 0, 0.95)';
      photoControls.style.padding = '15px 20px';
      photoControls.style.justifyContent = 'center';
      photoControls.style.gap = '15px';
      photoControls.style.boxSizing = 'border-box';
    }
    
    // 저장 버튼 강제 표시
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.style.display = 'inline-block';
      saveBtn.style.visibility = 'visible';
      saveBtn.style.opacity = '1';
      saveBtn.style.animation = 'pulse 1.5s infinite';
      saveBtn.style.transform = 'scale(1.1)';
      // saveBtn.style.color = 'white';
      // saveBtn.style.padding = '12px 20px';
      // saveBtn.style.borderRadius = '8px';
      
    }
    
    // 공유 버튼과 돌아가기 버튼도 표시
    const shareBtn = document.getElementById('share-btn');
    const backBtn = document.getElementById('back-btn');
    
    if (shareBtn) {
      shareBtn.style.display = 'inline-block';
      shareBtn.style.visibility = 'visible';
      shareBtn.style.opacity = '1';
    }
    
    if (backBtn) {
      backBtn.style.display = 'inline-block';
      backBtn.style.visibility = 'visible';
      backBtn.style.opacity = '1';
    }
    
    console.log('강제 저장 버튼 표시 완료');
  }
  
  showPhotoGuidance() {
    // 캐릭터별 촬영 완료 안내문구 표시
    const character = document.getElementById('character');
    const photoGuidance = character ? character.getAttribute('data-photo-guidance') : null;
    
    if (photoGuidance) {
      // 기존 안내문구 제거
      const existingGuidance = document.querySelector('.photo-guidance-message');
      if (existingGuidance) {
        existingGuidance.remove();
      }
      
      const guidanceDiv = document.createElement('div');
      guidanceDiv.className = 'photo-guidance-message';
      guidanceDiv.innerHTML = photoGuidance;
      guidanceDiv.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 20px 30px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: 500;
        z-index: 100001;
        text-align: center;
        max-width: 80%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        animation: fadeInScale 0.5s ease-out;
        font-family: 'Noto Sans KR', sans-serif;
      `;
      
      this.photoResult.appendChild(guidanceDiv);
      
      // 3초 후 서서히 사라짐
      setTimeout(() => {
        if (guidanceDiv.parentNode) {
          guidanceDiv.style.animation = 'fadeOutScale 0.5s ease-in';
          setTimeout(() => {
            if (guidanceDiv.parentNode) {
              guidanceDiv.remove();
            }
          }, 500);
        }
      }, 3000);
    }
  }
  
  
  retakePhoto() {
    console.log('=== 다시 찍기 시작 ===');
    console.log('retakePhoto 메서드 호출됨');
    
    // photoResult 요소 확인
    if (!this.photoResult) {
      console.error('photoResult 요소가 없습니다');
      return;
    }
    
    console.log('photoResult 요소 확인됨:', this.photoResult);
    
    // 말풍선 숨기기
    const speechBubble = document.getElementById('speech-bubble');
    if (speechBubble) {
      console.log('말풍선 숨김 처리');
      speechBubble.classList.remove('show');
      speechBubble.style.display = 'none';
    } else {
      console.log('말풍선 요소를 찾을 수 없음');
    }
    
    // 액션 버튼들 숨기기
    const photoActions = document.getElementById('photo-actions');
    if (photoActions) {
      console.log('액션 버튼들 숨김 처리');
      photoActions.style.display = 'none';
      photoActions.style.visibility = 'hidden';
      photoActions.style.opacity = '0';
    } else {
      console.log('액션 버튼 요소를 찾을 수 없음');
    }
    
    // 사진 컨트롤 버튼들 숨기기
    const photoControls = document.getElementById('photo-controls');
    if (photoControls) {
      photoControls.style.display = 'none';
      photoControls.style.visibility = 'hidden';
      photoControls.style.opacity = '0';
    }
    
    // 촬영된 이미지 숨기기
    if (this.capturedPhoto) {
      this.capturedPhoto.style.display = 'none';
    }
    
    // 사진 결과 화면 숨기기
    console.log('사진 결과 화면 숨김 처리 시작');
    this.photoResult.classList.remove('show');
    
    setTimeout(() => {
      console.log('사진 결과 화면 완전히 숨김');
      this.photoResult.style.display = 'none';
      this.photoResult.style.visibility = 'hidden';
      this.photoResult.style.opacity = '0';
      
      // 비디오와 카메라 컨테이너 다시 표시
      if (this.video) {
        this.video.style.display = 'block';
      }
      const cameraContainer = document.getElementById('camera-container');
      if (cameraContainer) {
        cameraContainer.style.display = 'block';
      }
      
      // 원래 화면의 요소들 다시 표시
      console.log('원래 화면 요소들 복원 시작');
      this.showOriginalElements();
      console.log('=== 다시 찍기 완료 ===');
    }, 300);
  }
  
  backToCamera() {
    // 말풍선 숨기기
    const speechBubble = document.getElementById('speech-bubble');
    if (speechBubble) {
      speechBubble.classList.remove('show');
    }
    
    // 액션 버튼들 숨기기
    const photoActions = document.getElementById('photo-actions');
    if (photoActions) {
      photoActions.style.opacity = '0';
    }
    
    this.photoResult.classList.remove('show');
    setTimeout(() => {
      this.photoResult.style.display = 'none';
      // 원래 화면의 요소들 다시 표시
      this.showOriginalElements();
    }, 300);
  }
  
  async savePhoto() {
    if (!this.capturedImageData && !this.capturedBaseImage) {
      this.showNotification('저장할 사진이 없습니다. 먼저 사진을 찍어주세요!', 'error');
      return;
    }
    
    try {
      // 저장 중 표시
      this.showNotification('사진을 저장하고 있습니다...', 'info');
      
      // 말풍선이 포함된 최종 이미지 생성
      const finalImageData = await this.createFinalImageWithBubble();
      
      // Web Share API 지원 확인 (모바일에서 갤러리에 저장하는 가장 좋은 방법)
      if (navigator.share && navigator.canShare) {
        try {
          // base64 데이터를 Blob으로 변환
          const imageDataUrl = finalImageData || this.capturedImageData;
          const base64Data = imageDataUrl.split(',')[1] || imageDataUrl;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });
          
          const timestamp = new Date().toISOString().split('T')[0];
          const file = new File([blob], `AR_Photo_${timestamp}.png`, { type: 'image/png' });
          
          // Web Share API로 공유 (갤러리에 저장 옵션 포함)
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'AR 체험 사진',
              text: 'AR 체험을 완료했습니다!',
              files: [file]
            });
            
            // 저장 완료 알림
            this.showNotification('사진이 갤러리에 저장되었습니다! 📸', 'success');
            return;
          }
        } catch (shareError) {
          // 사용자가 공유를 취소했거나 오류 발생 시 다운로드로 폴백
          console.log('공유 실패, 다운로드로 전환:', shareError);
        }
      }
      
      // Web Share API 미지원 또는 실패 시 다운로드 링크 사용
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `AR_Photo_${timestamp}.png`;
      link.href = finalImageData || this.capturedImageData;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // 약간의 지연 후 제거 (iOS Safari에서 다운로드가 완료되도록)
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
      
      // 저장 완료 알림
      setTimeout(() => {
        this.showNotification('사진이 저장되었습니다! 📸', 'success');
      }, 500);
      
    } catch (error) {
      console.error('사진 저장 중 오류 발생:', error);
      this.showNotification('사진 저장 중 오류가 발생했습니다. 다시 시도해주세요.', 'error');
    }
  }
  
  createFinalImageWithBubble() {
    try {
      // 베이스 이미지 (캐릭터 포함)
      const baseImage = this.capturedBaseImage || this.capturedImageData;
      if (!baseImage) {
        console.warn('베이스 이미지가 없습니다.');
        return Promise.resolve(this.capturedImageData);
      }
      
      // 말풍선 이미지 가져오기
      const bubbleImg = document.getElementById('result-speech-image');
      if (!bubbleImg || !bubbleImg.complete || bubbleImg.naturalWidth === 0) {
        console.warn('말풍선 이미지가 없거나 로드되지 않았습니다.');
        return Promise.resolve(this.capturedImageData);
      }
      
      // 비디오 표시 정보 사용 (촬영 시 저장된 정보)
      const videoRect = this.videoDisplayInfo || (this.video ? this.video.getBoundingClientRect() : { left: 0, top: 0, width: this.canvas.width, height: this.canvas.height });
      
      // 말풍선의 실제 화면 위치 가져오기
      const bubble = document.getElementById('speech-bubble');
      if (!bubble) {
        console.warn('말풍선 요소를 찾을 수 없습니다.');
        return Promise.resolve(this.capturedImageData);
      }
      
      const bubbleRect = bubble.getBoundingClientRect();
      
      // 비디오와 말풍선의 위치 관계 계산
      // videoRect가 객체인 경우 (videoDisplayInfo) 속성 직접 사용
      const videoLeft = typeof videoRect.left === 'number' ? videoRect.left : (videoRect.getBoundingClientRect ? videoRect.getBoundingClientRect().left : 0);
      const videoTop = typeof videoRect.top === 'number' ? videoRect.top : (videoRect.getBoundingClientRect ? videoRect.getBoundingClientRect().top : 0);
      const videoWidth = typeof videoRect.width === 'number' ? videoRect.width : (videoRect.getBoundingClientRect ? videoRect.getBoundingClientRect().width : this.canvas.width);
      const videoHeight = typeof videoRect.height === 'number' ? videoRect.height : (videoRect.getBoundingClientRect ? videoRect.getBoundingClientRect().height : this.canvas.height);
      
      // 캔버스 크기와 비디오 표시 크기의 비율 (이미 고해상도이므로 그대로 사용)
      const scaleX = this.canvas.width / videoWidth;
      const scaleY = this.canvas.height / videoHeight;
      
      // 말풍선 위치를 고해상도 캔버스 좌표로 변환
      const bubbleX = (bubbleRect.left - videoLeft) * scaleX;
      const bubbleY = (bubbleRect.top - videoTop) * scaleY;
      const bubbleWidth = bubbleRect.width * scaleX;
      const bubbleHeight = bubbleRect.height * scaleY;
      
      // 오프스크린 캔버스 생성 (고해상도 유지)
      const offCanvas = document.createElement('canvas');
      offCanvas.width = this.canvas.width;
      offCanvas.height = this.canvas.height;
      const offCtx = offCanvas.getContext('2d');
      
      // 고해상도 렌더링을 위한 이미지 스무딩 설정
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
      
      // 베이스 이미지 로드 및 그리기
      return new Promise((resolve) => {
        const baseImg = new Image();
        baseImg.onload = () => {
          // 베이스 이미지 그리기
          offCtx.drawImage(baseImg, 0, 0, offCanvas.width, offCanvas.height);
          
          // 말풍선 그리기
          offCtx.drawImage(bubbleImg, bubbleX, bubbleY, bubbleWidth, bubbleHeight);
          
          // 최종 이미지 데이터 반환
          const finalData = offCanvas.toDataURL('image/png');
          resolve(finalData);
        };
        baseImg.onerror = () => {
          console.warn('베이스 이미지 로드 실패');
          resolve(this.capturedImageData);
        };
        
        if (typeof baseImage === 'string') {
          baseImg.src = baseImage;
        } else if (baseImage && baseImage.src) {
          baseImg.src = baseImage.src;
        } else {
          console.warn('베이스 이미지 형식이 올바르지 않습니다.');
          resolve(this.capturedImageData);
        }
      });
    } catch (error) {
      console.error('최종 이미지 생성 중 오류:', error);
      return Promise.resolve(this.capturedImageData);
    }
  }
  
  addLocationTextToCanvas(ctx, width, height) {
    const locationInfo = document.querySelector('.location-info');
    if (locationInfo) {
      const locationText = locationInfo.textContent;
      
      // 배경 박스
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 300, 40);
      
      // 텍스트
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Noto Sans KR, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(locationText, 20, 35);
    }
  }
  
  sharePhoto() {
    if (!this.capturedImageData) {
      alert('공유할 사진이 없습니다.');
      return;
    }
    
    // Web Share API 지원 확인
    if (navigator.share) {
      // 이미지를 Blob으로 변환
      fetch(this.capturedImageData)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'ar_photo.png', { type: 'image/png' });
          
          navigator.share({
            title: 'AR 체험 사진',
            text: '특별한 AR 체험을 완료했습니다!',
            files: [file]
          }).catch(err => {
            console.log('공유 취소됨:', err);
          });
        });
    } else {
      // Web Share API 미지원 시 클립보드에 복사
      this.copyToClipboard();
    }
  }
  
  async copyToClipboard() {
    try {
      const response = await fetch(this.capturedImageData);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
      
      this.showNotification('사진이 클립보드에 복사되었습니다! 📋', 'success');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      alert('공유 기능을 사용할 수 없습니다. 사진을 저장하여 공유해주세요.');
    }
  }
  
  showNotification(message, type = 'info') {
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // 타입별 스타일 설정
    let backgroundColor, borderColor;
    switch (type) {
      case 'success':
        backgroundColor = 'rgba(40, 167, 69, 0.9)';
        borderColor = '#28a745';
        break;
      case 'error':
        backgroundColor = 'rgba(220, 53, 69, 0.9)';
        borderColor = '#dc3545';
        break;
      case 'warning':
        backgroundColor = 'rgba(255, 193, 7, 0.9)';
        borderColor = '#ffc107';
        break;
      default: // info
        backgroundColor = 'rgba(0, 123, 255, 0.9)';
        borderColor = '#007bff';
    }
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${backgroundColor};
      color: white;
      padding: 15px 25px;
      border-radius: 25px;
      font-family: 'Noto Sans KR', sans-serif;
      font-size: 16px;
      font-weight: 500;
      z-index: 1000;
      border: 2px solid ${borderColor};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideDown 0.3s ease-out;
      max-width: 90%;
      text-align: center;
      word-wrap: break-word;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideUp 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 3000);
  }
  
  fadeOutMusic(audioElement, callback) {
    if (audioElement) {
      const fadeOut = () => {
        if (audioElement.volume > 0.01) {
          audioElement.volume = Math.max(0, audioElement.volume - 0.05);
          setTimeout(fadeOut, 50);
        } else {
          audioElement.pause();
          audioElement.currentTime = 0;
          if (callback) callback();
        }
      };
      fadeOut();
    }
  }
  
  // 사용 가능한 카메라 목록 가져오기
  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      console.log('사용 가능한 카메라:', this.availableCameras.length + '개');
    } catch (error) {
      console.error('카메라 목록 조회 실패:', error);
    }
  }
  
  // 카메라 전환 기능 제거됨 - 셀카 모드는 지원하지 않음
  
  // 배경음악 재개 함수 (여러 방법으로 시도)
  resumeBackgroundMusic() {
    if (!this.backgroundMusic || !this.wasMusicPlaying) {
      return;
    }
    
    // 즉시 재생 시도
    const tryPlay = () => {
      if (this.backgroundMusic && this.wasMusicPlaying && this.backgroundMusic.paused) {
        this.backgroundMusic.play().then(() => {
          console.log('배경음악 재생 재개');
          // 재생 성공 시 이벤트 리스너 제거
          if (this.resumeMusicOnInteraction) {
            this.removeResumeMusicListeners();
          }
        }).catch(error => {
          console.log('배경음악 자동 재생 실패 (브라우저 정책), 사용자 상호작용 대기:', error.name);
          // 자동 재생이 실패하면 사용자 상호작용 시 재생하도록 설정
          this.setupResumeMusicOnInteraction();
        });
      }
    };
    
    // 즉시 시도
    tryPlay();
    
    // 50ms 후에도 재시도 (일부 브라우저에서 약간의 지연이 필요)
    setTimeout(tryPlay, 50);
    
    // 200ms 후에도 재시도
    setTimeout(tryPlay, 200);
  }
  
  removeResumeMusicListeners() {
    if (this.resumeMusicOnInteraction) {
      document.removeEventListener('click', this.resumeMusicOnInteraction);
      document.removeEventListener('touchstart', this.resumeMusicOnInteraction);
      document.removeEventListener('keydown', this.resumeMusicOnInteraction);
      document.removeEventListener('mousemove', this.resumeMusicOnInteraction);
      document.removeEventListener('touchmove', this.resumeMusicOnInteraction);
      this.resumeMusicOnInteraction = null;
    }
  }
  
  setupResumeMusicOnInteraction() {
    // 기존 리스너 제거
    this.removeResumeMusicListeners();
    
    // 새로운 리스너 생성
    this.resumeMusicOnInteraction = () => {
      if (this.backgroundMusic && this.wasMusicPlaying && this.backgroundMusic.paused) {
        this.backgroundMusic.play().then(() => {
          console.log('배경음악 재생 재개 (사용자 상호작용 후)');
          // 재생 성공 시 리스너 제거
          this.removeResumeMusicListeners();
        }).catch(error => {
          console.error('배경음악 재생 실패:', error);
        });
      }
    };
    
    // 사용자 상호작용 이벤트 리스너 추가 (더 많은 이벤트 타입)
    document.addEventListener('click', this.resumeMusicOnInteraction, { once: true, passive: true });
    document.addEventListener('touchstart', this.resumeMusicOnInteraction, { once: true, passive: true });
    document.addEventListener('keydown', this.resumeMusicOnInteraction, { once: true });
    document.addEventListener('mousemove', this.resumeMusicOnInteraction, { once: true, passive: true });
    document.addEventListener('touchmove', this.resumeMusicOnInteraction, { once: true, passive: true });
  }
  
  // 정리 함수
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    this.clearCharacterGuideTimers();
    
    // 음악 정리
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
    }
    
    // 이벤트 리스너 정리
    this.removeResumeMusicListeners();
  }
  
  scheduleCharacterGuide(delay = 400, duration = 4200) {
    if (!this.characterGuide) return;
    
    this.clearCharacterGuideTimers();
    this.characterGuide.classList.remove('show');
    
    this.characterGuideShowTimeout = setTimeout(() => {
      this.characterGuideShowTimeout = null;
      if (!this.characterGuide) return;
      this.characterGuide.classList.add('show');
      this.characterGuideHideTimeout = setTimeout(() => {
        this.characterGuideHideTimeout = null;
        if (this.characterGuide) {
          this.characterGuide.classList.remove('show');
        }
      }, duration);
    }, delay);
  }
  
  hideCharacterGuide() {
    if (!this.characterGuide) return;
    this.clearCharacterGuideTimers();
    this.characterGuide.classList.remove('show');
  }
  
  clearCharacterGuideTimers() {
    if (this.characterGuideShowTimeout) {
      clearTimeout(this.characterGuideShowTimeout);
      this.characterGuideShowTimeout = null;
    }
    if (this.characterGuideHideTimeout) {
      clearTimeout(this.characterGuideHideTimeout);
      this.characterGuideHideTimeout = null;
    }
  }
  
  moveCharacterToDefaultPosition() {
    // 캐릭터를 기본 위치로 부드럽게 이동
    // top과 left를 제거하고 transform만 사용하여 위치 이동
    this.character.style.transition = 'transform 1s ease-in-out, opacity 0.3s ease';
    this.character.style.zIndex = '10'; // 기본 z-index로 복원
    
    // 캐릭터 상태 초기화 (말풍선 영역을 피한 위치)
    this.characterState.x = 0;
    this.characterState.y = 0; // 기본 위치는 말풍선 영역 밖
    
    // 중앙에서 시작하여 기본 위치로 이동
    // updateCharacterTransform()을 즉시 호출하여 부드럽게 이동
    this.updateCharacterTransform();
    
    // 이동 완료 후 transition 제거
    setTimeout(() => {
      this.character.style.transition = '';
    }, 1000);
  }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  }
  
  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: translateX(-50%) scale(0.8);
    }
    100% {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
  }
  
  @keyframes fadeOutScale {
    0% {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) scale(0.8);
    }
  }
`;
document.head.appendChild(style);

// 스플래시 화면 관리
class SplashManager {
  constructor() {
    this.splashScreen = document.getElementById('splash-screen');
    this.backgroundMusic = document.getElementById('background-music');
    this.isVisible = true;
    this.resourcesLoaded = false;
    this.init();
  }
  
  init() {
    if (this.splashScreen) {
      // 모든 리소스 로드 대기
      this.loadAllResources().then(() => {
        this.resourcesLoaded = true;
        console.log('모든 리소스 로드 완료');
        
        // 리소스 로드 완료 후 배경음악 재생 시도
        this.startBackgroundMusic();
        
        // 스플래시 화면 클릭/터치 시 숨김 (사용자 인터랙션 필수)
        // 단, 최소 3초 + 리소스 로드 시간이 지나야만 숨길 수 있도록 함
        let splashStartTime = Date.now();
        let minDisplayTime = 3000; // 최소 3초
        
        // 스플래시 화면 클릭/터치를 사용자 상호작용으로 간주하여 효과음 활성화
        const activateSoundOnInteraction = () => {
          // if (window.webarInstance && window.webarInstance.characterAppearSound) {
          //   // 효과음을 미리 재생하고 중지하여 브라우저 정책 활성화
          //   window.webarInstance.characterAppearSound.play().then(() => {
          //     console.log('효과음 활성화 완료 (스플래시 상호작용)');
          //     window.webarInstance.characterAppearSound.pause();
          //     window.webarInstance.characterAppearSound.currentTime = 0;
          //   }).catch(error => {
          //     console.log('효과음 활성화 실패 (무시 가능):', error.name);
          //   });
          // }
        };
        
        const canHideSplash = () => {
          const elapsed = Date.now() - splashStartTime;
          return elapsed >= minDisplayTime;
        };
        
        const hideSplashIfAllowed = () => {
          // 사용자 상호작용으로 효과음 활성화
          activateSoundOnInteraction();
          
          if (canHideSplash()) {
            // 최소 시간이 지났으면 즉시 숨김
            this.hideSplash();
          } else {
            // 아직 3초가 지나지 않았으면 남은 시간 후에 숨김
            const remaining = minDisplayTime - (Date.now() - splashStartTime);
            setTimeout(() => {
              this.hideSplash();
            }, remaining);
          }
        };
        
        // 사용자가 클릭/터치해야만 넘어갈 수 있도록 이벤트 리스너 추가
        this.splashScreen.addEventListener('click', () => {
          hideSplashIfAllowed();
        });
        
        this.splashScreen.addEventListener('touchstart', () => {
          hideSplashIfAllowed();
        });
        
        // 자동으로 숨기는 기능 제거 - 사용자가 반드시 터치/클릭해야 함
        // (최소 3초는 유지하되, 사용자 인터랙션이 있을 때만 넘어감)
      });
    }
    
    // 페이지 가시성 변경 시 배경음악 제어
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 페이지가 숨겨질 때 음악 일시정지
        if (this.backgroundMusic && !this.backgroundMusic.paused) {
          this.backgroundMusic.pause();
        }
      }
    });
  }
  
  loadAllResources() {
    const promises = [];
    
    // 팝업 이미지 로드
    const splashImage = this.splashScreen ? this.splashScreen.querySelector('img') : null;
    if (splashImage) {
      const imagePromise = new Promise((resolve, reject) => {
        if (splashImage.complete && splashImage.naturalWidth > 0) {
          resolve();
        } else {
          splashImage.onload = resolve;
          splashImage.onerror = reject;
        }
      });
      promises.push(imagePromise);
    }
    
    // 배경음악 로드
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = 0.3;
      const musicPromise = new Promise((resolve) => {
        if (this.backgroundMusic.readyState >= 3) { // HAVE_FUTURE_DATA
          resolve();
        } else {
          this.backgroundMusic.addEventListener('canplaythrough', resolve, { once: true });
          this.backgroundMusic.load();
          
          // 타임아웃 설정 (최대 5초 대기)
          setTimeout(() => {
            console.warn('배경음악 로드 타임아웃');
            resolve();
          }, 5000);
        }
      });
      promises.push(musicPromise);
    }
    
    // 효과음 로드 (window.webarInstance가 설정되기를 기다림)
    const loadEffectSound = () => {
      const characterAppearSound = window.webarInstance ? window.webarInstance.characterAppearSound : null;
      if (characterAppearSound) {
        characterAppearSound.volume = 1.0;
        const soundPromise = new Promise((resolve) => {
          if (characterAppearSound.readyState >= 3) {
            resolve();
          } else {
            characterAppearSound.addEventListener('canplaythrough', resolve, { once: true });
            characterAppearSound.load();
            
            // 타임아웃 설정 (최대 5초 대기)
            setTimeout(() => {
              console.warn('효과음 로드 타임아웃');
              resolve();
            }, 5000);
          }
        });
        promises.push(soundPromise);
      }
    };
    
    // window.webarInstance가 이미 있으면 즉시 로드, 없으면 잠시 대기
    if (window.webarInstance) {
      loadEffectSound();
    } else {
      // DOMContentLoaded 후에 다시 시도
      setTimeout(() => {
        loadEffectSound();
      }, 100);
    }
    
    return Promise.all(promises);
  }
  
  startBackgroundMusic() {
    if (this.backgroundMusic) {
      // 음악 인디케이터 요소 가져오기
      const musicIndicator = document.getElementById('music-indicator');
      const musicText = musicIndicator ? musicIndicator.querySelector('.music-text') : null;
      
      // 음악 재생 설정
      this.backgroundMusic.volume = 0.3; // 볼륨을 30%로 설정
      
      // 음악 로딩 상태 업데이트
      this.updateMusicIndicator('로딩 중...', musicText);
      
      // 사용자 인터랙션 없이 즉시 재생 시도
      const playMusic = () => {
        this.backgroundMusic.play()
          .then(() => {
            this.updateMusicIndicator('재생 중', musicText);
            console.log('배경음악 재생 시작');
            
            // 효과음도 미리 활성화
            if (window.webarInstance && window.webarInstance.characterAppearSound) {
              window.webarInstance.characterAppearSound.volume = 1.0;
              window.webarInstance.characterAppearSound.load();
            }
          })
          .catch(error => {
            console.warn('배경음악 자동 재생 실패 (브라우저 정책):', error);
            this.updateMusicIndicator('재생 불가', musicText);
            
            // 재생 실패 시 사용자 상호작용을 기다림
            const playOnInteraction = () => {
              this.backgroundMusic.play()
                .then(() => {
                  this.updateMusicIndicator('재생 중', musicText);
                  console.log('배경음악 재생 시작 (사용자 상호작용 후)');
                })
                .catch(err => {
                  console.error('배경음악 재생 실패:', err);
                });
              
              // 이벤트 리스너 제거
              document.removeEventListener('click', playOnInteraction);
              document.removeEventListener('touchstart', playOnInteraction);
              document.removeEventListener('keydown', playOnInteraction);
            };
            
            document.addEventListener('click', playOnInteraction, { once: true });
            document.addEventListener('touchstart', playOnInteraction, { once: true });
            document.addEventListener('keydown', playOnInteraction, { once: true });
          });
      };
      
      // 즉시 재생 시도
      playMusic();
    }
  }
  
  updateMusicIndicator(text, musicTextElement) {
    if (musicTextElement) {
      musicTextElement.textContent = text;
    }
  }
  
  hideSplash() {
    if (this.splashScreen && this.isVisible) {
      this.splashScreen.classList.add('fade-out');
      this.isVisible = false;
      
      // 배경음악은 계속 재생 (페이드아웃하지 않음)
      // this.fadeOutMusic(); // 이 줄을 주석 처리
      
      // 애니메이션 완료 후 DOM에서 제거
      setTimeout(() => {
        if (this.splashScreen.parentNode) {
          this.splashScreen.style.display = 'none';
        }
        
        // 스플래시가 완전히 사라진 후 하단 컨트롤 표시
        const controls = document.getElementById('controls');
        if (controls) {
          controls.style.opacity = '1';
          controls.style.visibility = 'visible';
          controls.style.pointerEvents = 'auto';
        }
        
        // 스플래시 화면이 사라진 후 빛줄기 등장 시작
        if (window.webarInstance) {
          window.webarInstance.startExperience();
        }
      }, 500); // CSS transition 시간과 동일하게 설정
    }
  }
  
  fadeOutMusic() {
    if (this.backgroundMusic) {
      // 음악 인디케이터 업데이트
      const musicIndicator = document.getElementById('music-indicator');
      const musicText = musicIndicator ? musicIndicator.querySelector('.music-text') : null;
      if (musicText) {
        musicText.textContent = '정지 중...';
      }
      
      // 페이드아웃 효과
      const fadeOut = () => {
        if (this.backgroundMusic.volume > 0.01) {
          this.backgroundMusic.volume = Math.max(0, this.backgroundMusic.volume - 0.05);
          setTimeout(fadeOut, 50);
        } else {
          this.backgroundMusic.pause();
          this.backgroundMusic.currentTime = 0; // 처음부터 다시 재생할 수 있도록
          if (musicText) {
            musicText.textContent = '정지됨';
          }
        }
      };
      
      fadeOut();
    }
  }
  
  // 강제로 스플래시 화면 숨기기 (필요시 사용)
  forceHide() {
    this.hideSplash();
  }
}

// 화면 방향 고정 및 감지
class OrientationManager {
  constructor() {
    this.orientationWarning = document.getElementById('orientation-warning');
    this.init();
  }
  
  init() {
    // 초기 방향 확인
    this.checkOrientation();
    
    // 방향 변경 감지
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.checkOrientation();
      }, 100);
    });
    
    window.addEventListener('resize', () => {
      this.checkOrientation();
    });
    
    // Screen Orientation API로 방향 고정 시도 (지원되는 경우)
    this.lockOrientation();
  }
  
  checkOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (this.orientationWarning) {
      if (isLandscape && isMobile) {
        // 가로 모드일 때 경고 표시
        this.orientationWarning.classList.add('show');
      } else {
        // 세로 모드일 때 경고 숨김
        this.orientationWarning.classList.remove('show');
      }
    }
  }
  
  async lockOrientation() {
    // Screen Orientation API 지원 확인 및 세로 모드 고정 시도
    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock('portrait');
        console.log('화면 방향이 세로 모드로 고정되었습니다.');
      } catch (error) {
        // 방향 고정 실패 (일부 브라우저/기기에서는 제한됨)
        console.log('화면 방향 고정을 지원하지 않거나 실패:', error);
      }
    } else if (screen.lockOrientation) {
      // 구형 API 지원
      try {
        screen.lockOrientation('portrait');
      } catch (error) {
        console.log('화면 방향 고정을 지원하지 않거나 실패:', error);
      }
    } else if (screen.mozLockOrientation) {
      // Firefox 지원
      try {
        screen.mozLockOrientation('portrait');
      } catch (error) {
        console.log('화면 방향 고정을 지원하지 않거나 실패:', error);
      }
    } else if (screen.msLockOrientation) {
      // IE/Edge 지원
      try {
        screen.msLockOrientation('portrait');
      } catch (error) {
        console.log('화면 방향 고정을 지원하지 않거나 실패:', error);
      }
    }
  }
}

// 페이지 로드 시 WebAR 체험 시작
document.addEventListener('DOMContentLoaded', () => {
  // 화면 방향 관리자 초기화
  const orientationManager = new OrientationManager();
  
  // WebAR 체험을 먼저 시작 (카메라를 백그라운드에서 활성화)
  const webar = new WebARExperience();
  // 전역 변수로 저장하여 다른 곳에서 접근 가능하도록
  window.webarInstance = webar;
  
  // 페이지 언로드 시 정리
  window.addEventListener('beforeunload', () => {
    webar.cleanup();
  });
  
  // 스플래시 화면 관리자 초기화 (카메라 위에 표시)
  const splashManager = new SplashManager();
});
