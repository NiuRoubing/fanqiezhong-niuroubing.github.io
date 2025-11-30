// 音频上下文和音频数据
let audioContext;
const beepSound = {
  frequency: 800,
  duration: 200,
  volume: 0.5
};

// 初始化音频上下文
function initAudio() {
  try {
    // 修复iOS上的音频自动播放限制
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
  } catch(e) {
    console.warn('Web Audio API is not supported in this browser');
  }
}

// 播放提示音
function playBeep() {
  if (!audioContext) {
    initAudio();
  }
  
  try {
    // 如果音频上下文被挂起，恢复它
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = beepSound.frequency;
    gainNode.gain.value = beepSound.volume;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + beepSound.duration / 1000);
    setTimeout(() => oscillator.stop(), beepSound.duration);
  } catch(e) {
    console.warn('Failed to play beep sound:', e);
    // 降级方案：使用HTML5音频元素
    const audio = document.getElementById('timer-end-sound');
    if (audio) {
      audio.play().catch(e => console.warn('Failed to play fallback sound:', e));
    }
  }
}

// 播放多次提示音
function playCompletionSound() {
  // 播放三次提示音，间隔200ms
  playBeep();
  setTimeout(playBeep, 300);
  setTimeout(playBeep, 600);
}

// Timer类
class Timer {
  constructor() {
    this.mode = 'pomodoro'; // 默认模式为番茄钟
    this.isRunning = false;
    this.isPaused = false;
    this.remainingTime = 25 * 60; // 默认25分钟
    this.workDuration = 25 * 60; // 工作时长（秒）
    this.breakDuration = 5 * 60; // 休息时长（秒）
    this.timerId = null;
    this.startTime = null;
    this.elapsedTime = 0;
    this.pomodoroCount = 0;
    this.totalFocusTime = 0;
    this.isBreak = false;
    this.autoStartBreak = true;
    this.autoStartPomodoro = true;
    this.background = 'default'; // 默认背景
    
    // DOM元素
    this.timerDisplay = document.getElementById('timer-display');
    this.timerStatus = document.getElementById('timer-status');
    this.progressRing = document.getElementById('progress-ring');
    this.startBtn = document.getElementById('start-btn');
    this.pauseBtn = document.getElementById('pause-btn');
    this.resetBtn = document.getElementById('reset-btn');
    this.modeBtns = document.querySelectorAll('.mode-btn');
    this.pomodoroBtn = document.getElementById('pomodoro-btn');
    this.stopwatchBtn = document.getElementById('stopwatch-btn');
    this.timerBtn = document.getElementById('timer-btn');
    this.pomodoroSettings = document.getElementById('pomodoro-settings');
    this.stopwatchSettings = document.getElementById('stopwatch-settings');
    this.timerSettings = document.getElementById('timer-settings');
    this.workDurationInput = document.getElementById('work-duration');
    this.breakDurationInput = document.getElementById('break-duration');
    this.autoStartBreakInput = document.getElementById('auto-start-break');
    this.autoStartPomodoroInput = document.getElementById('auto-start-pomodoro');
    this.hoursInput = document.getElementById('hours');
    this.minutesInput = document.getElementById('minutes');
    this.secondsInput = document.getElementById('seconds');
    this.setTimerBtn = document.getElementById('set-timer-btn');
    this.completedPomodorosEl = document.getElementById('completed-pomodoros');
    this.focusTimeEl = document.getElementById('focus-time');
    this.backgroundOptions = document.querySelectorAll('.background-option');
    
    // 初始化
    this.init();
  }
  
  // 初始化
  init() {
    // 设置圆形进度条
    this.setProgressRing();
    
    // 加载设置
    this.loadSettings();
    
    // 加载统计数据
    this.loadStats();
    
    // 更新显示
    this.updateDisplay();
    
    // 添加事件监听器
    this.addEventListeners();
    
    // 初始化音频
    initAudio();
  }
  
  // 设置圆形进度条
  setProgressRing() {
    const circle = this.progressRing;
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;
    
    this.circumference = circumference;
  }
  
  // 更新进度条
  updateProgressRing() {
    if (!this.circumference) return;
    
    const circle = this.progressRing;
    let offset;
    
    if (this.mode === 'pomodoro' || this.mode === 'timer') {
      const totalTime = this.mode === 'pomodoro' ? 
        (this.isBreak ? this.breakDuration : this.workDuration) : 
        this.remainingTime;
      const progress = (this.remainingTime / totalTime);
      offset = this.circumference * (1 - progress);
    } else if (this.mode === 'stopwatch') {
      // 对于正计时，进度条每60秒循环一次
      const progress = (this.elapsedTime % 60) / 60;
      offset = this.circumference * (1 - progress);
    }
    
    circle.style.strokeDashoffset = offset;
  }
  
  // 加载设置
  loadSettings() {
    const settings = JSON.parse(localStorage.getItem('timerSettings')) || {};
    
    this.workDuration = settings.workDuration || 25 * 60;
    this.breakDuration = settings.breakDuration || 5 * 60;
    this.autoStartBreak = settings.autoStartBreak !== undefined ? settings.autoStartBreak : true;
    this.autoStartPomodoro = settings.autoStartPomodoro !== undefined ? settings.autoStartPomodoro : true;
    this.background = settings.background || 'default';
    
    // 更新UI
    this.workDurationInput.value = Math.floor(this.workDuration / 60);
    this.breakDurationInput.value = Math.floor(this.breakDuration / 60);
    this.autoStartBreakInput.checked = this.autoStartBreak;
    this.autoStartPomodoroInput.checked = this.autoStartPomodoro;
    
    // 设置剩余时间
    this.remainingTime = this.workDuration;
    
    // 设置背景
    this.applyBackground(this.background);
  }
  
  // 保存设置
  saveSettings() {
    const settings = {
      workDuration: this.workDuration,
      breakDuration: this.breakDuration,
      autoStartBreak: this.autoStartBreak,
      autoStartPomodoro: this.autoStartPomodoro,
      background: this.background
    };
    
    localStorage.setItem('timerSettings', JSON.stringify(settings));
  }
  
  // 加载统计数据
  loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = JSON.parse(localStorage.getItem('timerStats')) || {};
    
    if (stats.date === today) {
      this.pomodoroCount = stats.pomodoroCount || 0;
      this.totalFocusTime = stats.totalFocusTime || 0;
    } else {
      this.pomodoroCount = 0;
      this.totalFocusTime = 0;
    }
    
    this.updateStatsDisplay();
  }
  
  // 保存统计数据
  saveStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      date: today,
      pomodoroCount: this.pomodoroCount,
      totalFocusTime: this.totalFocusTime
    };
    
    localStorage.setItem('timerStats', JSON.stringify(stats));
  }
  
  // 更新统计数据显示
  updateStatsDisplay() {
    this.completedPomodorosEl.textContent = this.pomodoroCount;
    
    // 格式化总专注时间为HH:MM
    const hours = Math.floor(this.totalFocusTime / 3600);
    const minutes = Math.floor((this.totalFocusTime % 3600) / 60);
    this.focusTimeEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // 添加事件监听器
  addEventListeners() {
    // 模式切换按钮
    this.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // 如果计时器正在运行，先停止
        if (this.isRunning) {
          this.stop();
        }
        
        // 更新按钮状态
        this.modeBtns.forEach(b => {
          b.classList.remove('active');
          b.classList.remove('bg-primary');
          b.classList.remove('text-white');
          b.classList.remove('border-primary');
          b.classList.add('bg-white');
          b.classList.add('text-gray-700');
          b.classList.add('border-gray-300');
        });
        
        btn.classList.add('active');
        btn.classList.add('bg-primary');
        btn.classList.add('text-white');
        btn.classList.add('border-primary');
        btn.classList.remove('bg-white');
        btn.classList.remove('text-gray-700');
        btn.classList.remove('border-gray-300');
        
        // 设置模式
        if (btn.id === 'pomodoro-btn') {
          this.setMode('pomodoro');
        } else if (btn.id === 'stopwatch-btn') {
          this.setMode('stopwatch');
        } else if (btn.id === 'timer-btn') {
          this.setMode('timer');
        }
      });
    });
    
    // 开始按钮
    this.startBtn.addEventListener('click', () => this.start());
    
    // 暂停按钮
    this.pauseBtn.addEventListener('click', () => this.pause());
    
    // 重置按钮
    this.resetBtn.addEventListener('click', () => this.reset());
    
    // 番茄钟设置
    this.workDurationInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value > 0 && value <= 60) {
        this.workDuration = value * 60;
        if (!this.isRunning && !this.isBreak) {
          this.remainingTime = this.workDuration;
          this.updateDisplay();
        }
        this.saveSettings();
      }
    });
    
    this.breakDurationInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value) && value > 0 && value <= 60) {
        this.breakDuration = value * 60;
        if (!this.isRunning && this.isBreak) {
          this.remainingTime = this.breakDuration;
          this.updateDisplay();
        }
        this.saveSettings();
      }
    });
    
    this.autoStartBreakInput.addEventListener('change', (e) => {
      this.autoStartBreak = e.target.checked;
      this.saveSettings();
    });
    
    this.autoStartPomodoroInput.addEventListener('change', (e) => {
      this.autoStartPomodoro = e.target.checked;
      this.saveSettings();
    });
    
    // 倒计时设置
    this.setTimerBtn.addEventListener('click', () => {
      const hours = parseInt(this.hoursInput.value) || 0;
      const minutes = parseInt(this.minutesInput.value) || 0;
      const seconds = parseInt(this.secondsInput.value) || 0;
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      
      if (totalSeconds > 0) {
        this.remainingTime = totalSeconds;
        this.updateDisplay();
      }
    });
    
    // 背景选择
    this.backgroundOptions.forEach(option => {
      option.addEventListener('click', () => {
        const bg = option.dataset.bg;
        this.changeBackground(bg);
      });
    });
    
    // 键盘事件
    document.addEventListener('keydown', (e) => {
      // 空格键切换开始/暂停
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isRunning) {
          this.pause();
        } else if (!this.isRunning && (this.mode === 'stopwatch' || this.remainingTime > 0)) {
          this.start();
        }
      }
      
      // R键重置
      if (e.code === 'KeyR' && e.ctrlKey) {
        e.preventDefault();
        this.reset();
      }
    });
  }
  
  // 设置模式
  setMode(mode) {
    this.mode = mode;
    this.reset();
    
    // 显示对应的设置面板
    this.pomodoroSettings.classList.add('hidden');
    this.stopwatchSettings.classList.add('hidden');
    this.timerSettings.classList.add('hidden');
    
    if (mode === 'pomodoro') {
      this.pomodoroSettings.classList.remove('hidden');
      this.remainingTime = this.workDuration;
      this.isBreak = false;
    } else if (mode === 'stopwatch') {
      this.stopwatchSettings.classList.remove('hidden');
      this.elapsedTime = 0;
    } else if (mode === 'timer') {
      this.timerSettings.classList.remove('hidden');
      // 保持之前设置的时间或默认0
    }
    
    this.updateDisplay();
  }
  
  // 开始计时
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    
    // 更新按钮状态
    this.startBtn.classList.add('hidden');
    this.pauseBtn.classList.remove('hidden');
    
    // 设置开始时间
    this.startTime = Date.now() - (this.elapsedTime * 1000);
    
    // 根据模式设置计时器
    if (this.mode === 'pomodoro' || this.mode === 'timer') {
      this.timerId = setInterval(() => this.countdown(), 1000);
    } else if (this.mode === 'stopwatch') {
      this.timerId = setInterval(() => this.stopwatch(), 1000);
    }
    
    // 更新状态
    this.updateStatus();
  }
  
  // 暂停计时
  pause() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    this.isPaused = true;
    
    // 清除计时器
    clearInterval(this.timerId);
    
    // 更新按钮状态
    this.startBtn.classList.remove('hidden');
    this.pauseBtn.classList.add('hidden');
    
    // 更新状态
    this.updateStatus();
  }
  
  // 重置计时
  reset() {
    // 清除计时器
    clearInterval(this.timerId);
    
    this.isRunning = false;
    this.isPaused = false;
    
    // 更新按钮状态
    this.startBtn.classList.remove('hidden');
    this.pauseBtn.classList.add('hidden');
    
    // 根据模式重置时间
    if (this.mode === 'pomodoro') {
      this.remainingTime = this.isBreak ? this.breakDuration : this.workDuration;
    } else if (this.mode === 'timer') {
      // 保持用户设置的时间
    } else if (this.mode === 'stopwatch') {
      this.elapsedTime = 0;
    }
    
    // 更新显示
    this.updateDisplay();
    this.updateStatus();
  }
  
  // 倒计时
  countdown() {
    this.remainingTime--;
    
    // 更新显示
    this.updateDisplay();
    this.updateProgressRing();
    
    // 检查是否计时结束
    if (this.remainingTime <= 0) {
      this.timerComplete();
    }
  }
  
  // 正计时
  stopwatch() {
    this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // 更新显示
    this.updateDisplay();
    this.updateProgressRing();
  }
  
  // 计时完成
  timerComplete() {
    // 清除计时器
    clearInterval(this.timerId);
    this.isRunning = false;
    
    // 播放提示音
    playCompletionSound();
    
    // 更新按钮状态
    this.startBtn.classList.remove('hidden');
    this.pauseBtn.classList.add('hidden');
    
    // 根据模式处理完成逻辑
    if (this.mode === 'pomodoro') {
      if (!this.isBreak) {
        // 工作时间结束，切换到休息时间
        this.pomodoroCount++;
        this.totalFocusTime += this.workDuration;
        this.saveStats();
        this.updateStatsDisplay();
        
        this.isBreak = true;
        this.remainingTime = this.breakDuration;
        
        // 更新状态
        this.updateStatus();
        
        // 如果设置了自动开始休息，自动开始
        if (this.autoStartBreak) {
          setTimeout(() => this.start(), 1000);
        }
      } else {
        // 休息时间结束，切换到工作时间
        this.isBreak = false;
        this.remainingTime = this.workDuration;
        
        // 更新状态
        this.updateStatus();
        
        // 如果设置了自动开始下一个番茄钟，自动开始
        if (this.autoStartPomodoro) {
          setTimeout(() => this.start(), 1000);
        }
      }
    } else if (this.mode === 'timer') {
      // 倒计时结束
      this.updateStatus('计时结束');
    }
    
    // 更新显示
    this.updateDisplay();
  }
  
  // 更新显示
  updateDisplay() {
    let timeString;
    
    if (this.mode === 'pomodoro' || this.mode === 'timer') {
      const hours = Math.floor(this.remainingTime / 3600);
      const minutes = Math.floor((this.remainingTime % 3600) / 60);
      const seconds = this.remainingTime % 60;
      
      if (hours > 0) {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    } else if (this.mode === 'stopwatch') {
      const hours = Math.floor(this.elapsedTime / 3600);
      const minutes = Math.floor((this.elapsedTime % 3600) / 60);
      const seconds = this.elapsedTime % 60;
      
      if (hours > 0) {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    this.timerDisplay.textContent = timeString;
    this.updateProgressRing();
  }
  
  // 更新状态
  updateStatus(customStatus = '') {
    let status = '';
    
    if (customStatus) {
      status = customStatus;
    } else if (this.isRunning) {
      if (this.mode === 'pomodoro') {
        status = this.isBreak ? '休息中' : '工作中';
      } else if (this.mode === 'timer') {
        status = '倒计时中';
      } else if (this.mode === 'stopwatch') {
        status = '计时中';
      }
    } else if (this.isPaused) {
      status = '已暂停';
    } else {
      if (this.mode === 'pomodoro') {
        status = this.isBreak ? '休息准备' : '工作准备';
      } else if (this.mode === 'timer') {
        status = '设置倒计时';
      } else if (this.mode === 'stopwatch') {
        status = '准备开始';
      }
    }
    
    this.timerStatus.textContent = status;
  }
  
  // 更改背景
  changeBackground(bg) {
    this.background = bg;
    this.applyBackground(bg);
    this.saveSettings();
    
    // 更新UI
    this.backgroundOptions.forEach(option => {
      if (option.dataset.bg === bg) {
        option.classList.add('border-primary');
        option.classList.remove('border-transparent');
      } else {
        option.classList.remove('border-primary');
        option.classList.add('border-transparent');
      }
    });
  }
  
  // 应用背景
  applyBackground(bg) {
    const body = document.body;
    const container = document.querySelector('.container');
    const glassElements = document.querySelectorAll('.glass');
    const textElements = document.querySelectorAll('.text-dark, .text-gray-600, .text-gray-700, .text-gray-500');
    
    // 移除所有背景类和样式
    body.classList.remove(
      'bg-background', 
      'bg-[#FFF8E6]', 'bg-[#FFF3CD]', 'bg-[#FFE5B4]', // 黄色系
      'bg-[#FFE5E5]', 'bg-[#FFCDD2]', // 红色系
      'bg-[#E6F7FF]', 'bg-[#BBDEFB]', 'bg-[#90CAF9]', // 蓝色系
      'bg-[#E6FFEE]', 'bg-[#C8E6C9]', // 绿色系
      'bg-[#F0F0FF]', 'bg-[#E1BEE7]', // 紫色系
      'bg-[#FFEBEE]', 'bg-[#FCE4EC]', // 粉色系
      'bg-[#F5F5F5]', // 灰色系
      'text-white'
    );
    body.style.backgroundImage = '';
    body.style.backgroundSize = '';
    body.style.backgroundPosition = '';
    body.style.backgroundRepeat = '';
    
    // 重置文本颜色和玻璃效果
    textElements.forEach(el => {
      el.classList.remove('text-white', 'text-gray-300', 'text-gray-200');
      el.classList.add('text-dark', 'text-gray-600', 'text-gray-700', 'text-gray-500');
    });
    
    glassElements.forEach(el => {
      el.classList.remove('glass-dark');
      el.classList.add('glass');
    });
    
    // 应用新背景
    switch(bg) {
      case 'default':
        body.classList.add('bg-background');
        break;
      // 黄色系
      case 'yellow-light':
        body.classList.add('bg-[#FFF8E6]');
        break;
      case 'yellow':
        body.classList.add('bg-[#FFF3CD]');
        break;
      case 'yellow-dark':
        body.classList.add('bg-[#FFE5B4]');
        break;
      // 红色系
      case 'red-light':
        body.classList.add('bg-[#FFE5E5]');
        break;
      case 'red':
        body.classList.add('bg-[#FFCDD2]');
        break;
      // 蓝色系
      case 'blue-light':
        body.classList.add('bg-[#E6F7FF]');
        break;
      case 'blue':
        body.classList.add('bg-[#BBDEFB]');
        break;
      case 'blue-dark':
        body.classList.add('bg-[#90CAF9]');
        break;
      // 绿色系
      case 'green-light':
        body.classList.add('bg-[#E6FFEE]');
        break;
      case 'green':
        body.classList.add('bg-[#C8E6C9]');
        break;
      // 紫色系
      case 'purple-light':
        body.classList.add('bg-[#F0F0FF]');
        break;
      case 'purple':
        body.classList.add('bg-[#E1BEE7]');
        break;
      // 粉色系
      case 'pink-light':
        body.classList.add('bg-[#FFEBEE]');
        break;
      case 'pink':
        body.classList.add('bg-[#FCE4EC]');
        break;
      // 灰色系
      case 'gray-light':
        body.classList.add('bg-[#F5F5F5]');
        break;
    }
  }
}

// 页面加载完成后初始化计时器
document.addEventListener('DOMContentLoaded', () => {
  const timer = new Timer();
});
