const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPiece');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('holdPiece');
const holdCtx = holdCanvas.getContext('2d');

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
let BLOCK_SIZE = 45;

let board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let lines = 0;
let gameRunning = false;
let gamePaused = false;
let dropTime = 0;
let dropInterval = 1000;

// タッチ操作用の変数
let touchMoveInterval = null;
let touchDownInterval = null;

// 音響効果の初期化
let audioContext = null;
let bgmGain = null;
let sfxGain = null;

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        bgmGain = audioContext.createGain();
        sfxGain = audioContext.createGain();
        bgmGain.connect(audioContext.destination);
        sfxGain.connect(audioContext.destination);
        bgmGain.gain.value = 0.3;
        sfxGain.gain.value = 0.5;
    }
}

function playBGM() {
    if (!audioContext) return;
    
    // シンプルなBGM（ループするメロディー）
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
    const melody = [0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 5, 7, 7, 7];
    let noteIndex = 0;
    
    function playNote() {
        if (!gameRunning || gamePaused) return;
        
        const oscillator = audioContext.createOscillator();
        const noteGain = audioContext.createGain();
        
        oscillator.connect(noteGain);
        noteGain.connect(bgmGain);
        
        oscillator.frequency.value = notes[melody[noteIndex]];
        oscillator.type = 'square';
        
        noteGain.gain.setValueAtTime(0.1, audioContext.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        noteIndex = (noteIndex + 1) % melody.length;
        setTimeout(playNote, 400);
    }
    
    playNote();
}

function playLineClearSound() {
    if (!audioContext) return;
    
    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const noteGain = audioContext.createGain();
    
    oscillator1.connect(noteGain);
    oscillator2.connect(noteGain);
    noteGain.connect(sfxGain);
    
    oscillator1.frequency.value = 523.25; // C5
    oscillator2.frequency.value = 659.25; // E5
    oscillator1.type = 'square';
    oscillator2.type = 'square';
    
    noteGain.gain.setValueAtTime(0.3, audioContext.currentTime);
    noteGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.5);
    oscillator2.stop(audioContext.currentTime + 0.5);
}

const colors = [
    '#000000', // 空
    '#FFB3BA', // I - パステルピンク
    '#BAFFC9', // O - パステルグリーン
    '#BAE1FF', // T - パステルブルー
    '#FFFFBA', // S - パステルイエロー
    '#FFDFBA', // Z - パステルオレンジ
    '#E0BBE4', // J - パステルパープル
    '#C7CEEA'  // L - パステルラベンダー
];

const ghostColors = [
    '#000000', // 空
    '#FFB3BA40', // I - ゴースト（透明度付き）
    '#BAFFC940', // O - ゴースト
    '#BAE1FF40', // T - ゴースト
    '#FFFFBA40', // S - ゴースト
    '#FFDFBA40', // Z - ゴースト
    '#E0BBE440', // J - ゴースト
    '#C7CEEA40'  // L - ゴースト
];

const pieces = [
    // I
    [
        [1,1,1,1]
    ],
    // O
    [
        [2,2],
        [2,2]
    ],
    // T
    [
        [0,3,0],
        [3,3,3]
    ],
    // S
    [
        [0,4,4],
        [4,4,0]
    ],
    // Z
    [
        [5,5,0],
        [0,5,5]
    ],
    // J
    [
        [6,0,0],
        [6,6,6]
    ],
    // L
    [
        [0,0,7],
        [7,7,7]
    ]
];

class Piece {
    constructor(type) {
        this.type = type;
        this.shape = pieces[type].map(row => [...row]);
        this.x = Math.floor(BOARD_WIDTH / 2) - Math.floor(this.shape[0].length / 2);
        this.y = 0;
    }
    
    rotate() {
        const rotated = this.shape[0].map((_, i) => 
            this.shape.map(row => row[i]).reverse()
        );
        
        if (this.canMove(rotated, this.x, this.y)) {
            this.shape = rotated;
        }
    }
    
    canMove(shape, newX, newY) {
        for (let y = 0; y < shape.length; y++) {
            for (let x = 0; x < shape[y].length; x++) {
                if (shape[y][x] !== 0) {
                    const boardX = newX + x;
                    const boardY = newY + y;
                    
                    if (boardX < 0 || boardX >= BOARD_WIDTH || 
                        boardY >= BOARD_HEIGHT || 
                        (boardY >= 0 && board[boardY][boardX] !== 0)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    move(dx, dy) {
        if (this.canMove(this.shape, this.x + dx, this.y + dy)) {
            this.x += dx;
            this.y += dy;
            return true;
        }
        return false;
    }
    
    hardDrop() {
        while (this.move(0, 1)) {}
    }
}

function createPiece() {
    return new Piece(Math.floor(Math.random() * pieces.length));
}

function placePiece() {
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x] !== 0) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.shape[y][x];
                }
            }
        }
    }
}

function clearLines() {
    let linesCleared = 0;
    
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell !== 0)) {
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            y++; // 同じ行を再チェック
        }
    }
    
    if (linesCleared > 0) {
        playLineClearSound();
        lines += linesCleared;
        // 1行消去ごとに落下速度を速くする（最速値の設定もする）
        dropInterval = Math.max(50, 1000 - lines * 200);
        updateUI();
    }
}

function isGameOver() {
    return !currentPiece.canMove(currentPiece.shape, currentPiece.x, currentPiece.y);
}

function drawBlock(context, x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    context.strokeStyle = '#333';
    context.lineWidth = 1;
    context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function drawGhostBlock(context, x, y, color) {
    // ゴーストピース用の描画（透明度とボーダーのみ）
    context.strokeStyle = color.replace('40', ''); // 透明度を除去して境界線に使用
    context.lineWidth = 2;
    context.setLineDash([4, 4]); // 点線
    context.strokeRect(x * BLOCK_SIZE + 2, y * BLOCK_SIZE + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
    context.setLineDash([]); // 点線をリセット
}

function drawGridLines() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // 縦の罫線
    for (let x = 0; x <= BOARD_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
        ctx.stroke();
    }
    
    // 横の罫線
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(BOARD_WIDTH * BLOCK_SIZE, y * BLOCK_SIZE);
        ctx.stroke();
    }
}

function drawGridLinesForPreview(context, width, height) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    context.lineWidth = 1;
    
    const screenWidth = window.innerWidth;
    let blockSize = 20;
    
    if (screenWidth <= 320) blockSize = 10;
    else if (screenWidth <= 360) blockSize = 12;
    else if (screenWidth <= 480) blockSize = 14;
    else if (screenWidth <= 768) blockSize = 16;
    
    // 縦の罫線
    for (let x = 0; x <= width; x += blockSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    
    // 横の罫線
    for (let y = 0; y <= height; y += blockSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
}

function getGhostPiecePosition() {
    if (!currentPiece) return null;
    
    let ghostY = currentPiece.y;
    while (currentPiece.canMove(currentPiece.shape, currentPiece.x, ghostY + 1)) {
        ghostY++;
    }
    
    return {
        x: currentPiece.x,
        y: ghostY,
        shape: currentPiece.shape
    };
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // ボードの描画
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            if (board[y][x] !== 0) {
                drawBlock(ctx, x, y, colors[board[y][x]]);
            }
        }
    }
    
    // ゴーストピース（落下予測）の描画（ポーズ中は非表示）
    if (!gamePaused) {
        const ghostPos = getGhostPiecePosition();
        if (ghostPos && currentPiece) {
            for (let y = 0; y < ghostPos.shape.length; y++) {
                for (let x = 0; x < ghostPos.shape[y].length; x++) {
                    if (ghostPos.shape[y][x] !== 0) {
                        const drawX = ghostPos.x + x;
                        const drawY = ghostPos.y + y;
                        // 現在のピース位置と重ならない場合のみ描画
                        if (drawY >= 0 && drawY !== currentPiece.y + y) {
                            drawGhostBlock(ctx, drawX, drawY, ghostColors[ghostPos.shape[y][x]]);
                        }
                    }
                }
            }
        }
    }
    
    // 現在のピースの描画
    if (currentPiece) {
        for (let y = 0; y < currentPiece.shape.length; y++) {
            for (let x = 0; x < currentPiece.shape[y].length; x++) {
                if (currentPiece.shape[y][x] !== 0) {
                    const drawX = currentPiece.x + x;
                    const drawY = currentPiece.y + y;
                    if (drawY >= 0) {
                        drawBlock(ctx, drawX, drawY, colors[currentPiece.shape[y][x]]);
                    }
                }
            }
        }
    }
    
    // 罫線の描画
    drawGridLines();
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    // 背景に罫線を描画
    drawGridLinesForPreview(nextCtx, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const screenWidth = window.innerWidth;
        let blockSize = 20;
        
        if (screenWidth <= 320) blockSize = 10;
        else if (screenWidth <= 360) blockSize = 12;
        else if (screenWidth <= 480) blockSize = 14;
        else if (screenWidth <= 768) blockSize = 16;
        
        // ピースの実際のサイズを計算
        const pieceWidth = nextPiece.shape[0].length * blockSize;
        const pieceHeight = nextPiece.shape.length * blockSize;
        
        // キャンバスの中央に配置（タイトルとのセンタリングを合わせる）
        const offsetX = (nextCanvas.width - pieceWidth) / 2;
        const offsetY = (nextCanvas.height - pieceHeight) / 2;
        
        for (let y = 0; y < nextPiece.shape.length; y++) {
            for (let x = 0; x < nextPiece.shape[y].length; x++) {
                if (nextPiece.shape[y][x] !== 0) {
                    nextCtx.fillStyle = colors[nextPiece.shape[y][x]];
                    nextCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    nextCtx.strokeStyle = '#333';
                    nextCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                }
            }
        }
    }
}

function drawHoldPiece() {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    
    // 背景に罫線を描画
    drawGridLinesForPreview(holdCtx, holdCanvas.width, holdCanvas.height);
    
    if (holdPiece) {
        const screenWidth = window.innerWidth;
        let blockSize = 20;
        
        if (screenWidth <= 320) blockSize = 10;
        else if (screenWidth <= 360) blockSize = 12;
        else if (screenWidth <= 480) blockSize = 14;
        else if (screenWidth <= 768) blockSize = 16;
        
        // ピースの実際のサイズを計算
        const pieceWidth = holdPiece.shape[0].length * blockSize;
        const pieceHeight = holdPiece.shape.length * blockSize;
        
        // キャンバスの中央に配置（タイトルとのセンタリングを合わせる）
        const offsetX = (holdCanvas.width - pieceWidth) / 2;
        const offsetY = (holdCanvas.height - pieceHeight) / 2;
        
        for (let y = 0; y < holdPiece.shape.length; y++) {
            for (let x = 0; x < holdPiece.shape[y].length; x++) {
                if (holdPiece.shape[y][x] !== 0) {
                    const alpha = canHold ? 1.0 : 0.5; // ホールド不可の時は薄く表示
                    holdCtx.globalAlpha = alpha;
                    holdCtx.fillStyle = colors[holdPiece.shape[y][x]];
                    holdCtx.fillRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    holdCtx.strokeStyle = '#333';
                    holdCtx.strokeRect(
                        offsetX + x * blockSize,
                        offsetY + y * blockSize,
                        blockSize,
                        blockSize
                    );
                    holdCtx.globalAlpha = 1.0;
                }
            }
        }
    }
}

function holdCurrentPiece() {
    if (!canHold || !currentPiece) return;
    
    if (holdPiece === null) {
        // 初回ホールド
        holdPiece = new Piece(currentPiece.type);
        currentPiece = nextPiece;
        nextPiece = createPiece();
    } else {
        // ピース交換
        const tempType = holdPiece.type;
        holdPiece = new Piece(currentPiece.type);
        currentPiece = new Piece(tempType);
    }
    
    canHold = false; // 一度ホールドしたら次のピースまで使用不可
}

// タッチ操作ハンドラー
function handleTouch(action, event) {
    if (!gameRunning || !currentPiece) return;
    
    if (gamePaused) return;
    
    // タッチイベントとマウスイベントの重複を防ぐ
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    switch(action) {
        case 'left':
            currentPiece.move(-1, 0);
            // 連続移動のためのインターバル設定
            if (!touchMoveInterval) {
                touchMoveInterval = setInterval(() => {
                    if (currentPiece) currentPiece.move(-1, 0);
                }, 150);
            }
            break;
        case 'right':
            currentPiece.move(1, 0);
            // 連続移動のためのインターバル設定
            if (!touchMoveInterval) {
                touchMoveInterval = setInterval(() => {
                    if (currentPiece) currentPiece.move(1, 0);
                }, 150);
            }
            break;
        case 'down':
            currentPiece.move(0, 1);
            // 連続落下のためのインターバル設定
            if (!touchDownInterval) {
                touchDownInterval = setInterval(() => {
                    if (currentPiece) {
                        currentPiece.move(0, 1);
                    }
                }, 100);
            }
            break;
        case 'rotate':
            currentPiece.rotate();
            break;
        case 'drop':
            currentPiece.hardDrop();
            break;
        case 'hold':
            holdCurrentPiece();
            break;
    }
}

function stopTouch() {
    // インターバルをクリア
    if (touchMoveInterval) {
        clearInterval(touchMoveInterval);
        touchMoveInterval = null;
    }
    if (touchDownInterval) {
        clearInterval(touchDownInterval);
        touchDownInterval = null;
    }
}

// マウスイベント用のイベントリスナー追加
document.addEventListener('mouseup', stopTouch);
document.addEventListener('mouseleave', stopTouch);

function updateUI() {
    const linesElement = document.getElementById('lines');
    
    if (linesElement) {
        linesElement.textContent = lines;
    }
}

function gameLoop(timestamp) {
    if (!gameRunning) return;
    
    // ポーズ中でも描画は継続、ゲームロジックのみ停止
    if (!gamePaused) {
        if (timestamp - dropTime > dropInterval) {
            if (!currentPiece.move(0, 1)) {
                placePiece();
                clearLines();
                currentPiece = nextPiece;
                nextPiece = createPiece();
                canHold = true; // 新しいピースでホールド可能に
                
                if (isGameOver()) {
                    gameRunning = false;
                    document.getElementById('finalLines').textContent = lines;
                    document.getElementById('gameOver').style.display = 'block';
                    hideControlInstructions();
                    return;
                }
            }
            dropTime = timestamp;
        }
    }
    
    // ポーズ中でも画面の描画は継続
    drawBoard();
    drawNextPiece();
    drawHoldPiece();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    // 全ての画面を適切に設定
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    
    // PC画面の場合のみ操作説明を表示、それ以外は非表示
    const screenWidth = window.innerWidth;
    if (screenWidth >= 769) {
        document.getElementById('controlInstructions').style.display = 'block';
    } else {
        document.getElementById('controlInstructions').style.display = 'none';
    }
    
    // レスポンシブ対応でキャンバスサイズとブロックサイズを調整
    adjustCanvasSize();
    
    initAudio(); // 音響初期化
    
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
    lines = 0;
    dropInterval = 1000;
    gameRunning = true;
    gamePaused = false;
    holdPiece = null;
    canHold = true;
    
    currentPiece = createPiece();
    nextPiece = createPiece();
    
    updateUI();
    playBGM(); // BGM開始
    requestAnimationFrame(gameLoop);
}

function adjustCanvasSize() {
    const canvas = document.getElementById('gameBoard');
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // 画面サイズに応じて動的にキャンバスサイズを調整
    if (screenWidth <= 480) {
        // スマートフォン
        const availableHeight = screenHeight - 16; // パディング考慮
        const availableWidth = screenWidth - 112; // サイドパネル分を考慮（100px + gap + padding）
        const maxHeight = Math.min(availableHeight * 0.95, availableWidth * 2.2);
        const maxWidth = Math.min(maxHeight / 2, availableWidth);
        
        // ブロックサイズを先に計算
        BLOCK_SIZE = maxWidth / BOARD_WIDTH;
        
        // キャンバスサイズをブロックサイズの整数倍に調整
        canvas.width = BLOCK_SIZE * BOARD_WIDTH;
        canvas.height = BLOCK_SIZE * BOARD_HEIGHT;
    } else if (screenWidth <= 768) {
        // タブレット - より大きなプレイエリア
        const availableHeight = screenHeight - 24; // パディング最小化
        const availableWidth = screenWidth - 280; // サイドパネル分を考慮（幅拡張分）
        const maxHeight = Math.min(availableHeight * 0.95, availableWidth * 2.2);
        const maxWidth = maxHeight / 2;
        
        // ブロックサイズを先に計算
        BLOCK_SIZE = maxWidth / BOARD_WIDTH;
        
        // キャンバスサイズをブロックサイズの整数倍に調整
        canvas.width = BLOCK_SIZE * BOARD_WIDTH;
        canvas.height = BLOCK_SIZE * BOARD_HEIGHT;
    } else {
        // デスクトップ - より大きなプレイエリア
        const availableHeight = screenHeight - 32; // パディング最小化
        const availableWidth = screenWidth - 340; // サイドパネル分を考慮（幅拡張分）
        const maxHeight = Math.min(availableHeight * 0.95, availableWidth * 2.5, 900);
        const maxWidth = maxHeight / 2;
        
        // ブロックサイズを先に計算
        BLOCK_SIZE = maxWidth / BOARD_WIDTH;
        
        // キャンバスサイズをブロックサイズの整数倍に調整
        canvas.width = BLOCK_SIZE * BOARD_WIDTH;
        canvas.height = BLOCK_SIZE * BOARD_HEIGHT;
    }
}

function pauseGame() {
    if (!gameRunning) return;
    gamePaused = true;
    document.getElementById('pauseScreen').style.display = 'block';
    hideControlInstructions();
}

function resumeGame() {
    if (!gameRunning) return;
    gamePaused = false;
    document.getElementById('pauseScreen').style.display = 'none';
    
    // PC画面の場合のみ操作説明を再表示、それ以外は非表示
    const screenWidth = window.innerWidth;
    if (screenWidth >= 769) {
        document.getElementById('controlInstructions').style.display = 'block';
    } else {
        document.getElementById('controlInstructions').style.display = 'none';
    }
    
    playBGM(); // BGM再開
}


function hideControlInstructions() {
    document.getElementById('controlInstructions').style.display = 'none';
}

function returnToTitle() {
    // ゲーム状態をリセット
    gameRunning = false;
    gamePaused = false;
    
    // 画面を切り替え
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('startScreen').style.display = '';
    
    // 操作説明を非表示
    hideControlInstructions();
    
    // ページを再読み込みして初期状態に戻す
    location.reload();
}

document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    // ポーズ機能は常に有効
    if (e.code === 'KeyP') {
        if (gamePaused) {
            resumeGame();
        } else {
            pauseGame();
        }
        e.preventDefault();
        return;
    }
    
    // ポーズ中は他の操作を無効化
    if (gamePaused || !currentPiece) return;
    
    switch(e.code) {
        case 'ArrowLeft':
            currentPiece.move(-1, 0);
            break;
        case 'ArrowRight':
            currentPiece.move(1, 0);
            break;
        case 'ArrowDown':
            currentPiece.move(0, 1);
            break;
        case 'ArrowUp':
            currentPiece.rotate();
            break;
        case 'Space':
            currentPiece.hardDrop();
            break;
        case 'KeyC':
            holdCurrentPiece();
            break;
    }
    e.preventDefault();
});

// ウィンドウリサイズ時の対応
window.addEventListener('resize', () => {
    if (gameRunning) {
        adjustCanvasSize();
    }
    
    // リサイズ時に操作説明の表示・非表示を更新（ゲーム状態に関係なく）
    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer && gameContainer.style.display === 'flex') {
        const screenWidth = window.innerWidth;
        if (screenWidth >= 769) {
            document.getElementById('controlInstructions').style.display = 'block';
        } else {
            document.getElementById('controlInstructions').style.display = 'none';
        }
    }
});

// ページ読み込み時に操作説明を非表示
window.addEventListener('DOMContentLoaded', () => {
    hideControlInstructions();
});