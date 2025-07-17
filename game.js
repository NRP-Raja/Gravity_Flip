
        // Game state and configuration
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        let gameState = 'title'; // title, playing, gameOver
        let currentRoom = 1;
        let score = 0;
        let lives = 3;
        let cellsCollected = 0;
        let chainCount = 0;
        let lastCellTime = 0;
        let startTime = 0;
        let gravity = 1; // 1 = down, -1 = up
        let flipCooldown = 0;
        let maxFlipCooldown = 1000; // 1 second
        
        // Player data
        const player = {
            x: 100,
            y: 300,
            width: 20,
            height: 20,
            vx: 0,
            vy: 0,
            speed: 200,
            onGround: false,
            color: '#00ffff'
        };

        // Game objects
        let cells = [];
        let drones = [];
        let lasers = [];
        let debris = [];
        let powerUps = [];
        let particles = [];
        
        // Room templates
        const roomTemplates = [
            // Template 1: Basic corridor
            {
                cells: [{x: 200, y: 100}, {x: 400, y: 500}, {x: 600, y: 200}],
                drones: [{x: 300, y: 150, path: [{x: 200, y: 150}, {x: 400, y: 150}]}],
                lasers: [{x: 500, y: 0, width: 20, height: 600, interval: 2000}],
                theme: 'normal'
            },
            // Template 2: Vertical challenge
            {
                cells: [{x: 150, y: 200}, {x: 350, y: 400}, {x: 550, y: 100}, {x: 650, y: 300}],
                drones: [{x: 400, y: 300, path: [{x: 400, y: 200}, {x: 400, y: 400}]}],
                lasers: [{x: 250, y: 0, width: 20, height: 600, interval: 3000}],
                theme: 'normal'
            },
            // Template 3: Power-up room
            {
                cells: [{x: 300, y: 150}, {x: 500, y: 450}],
                drones: [{x: 200, y: 200, path: [{x: 100, y: 200}, {x: 300, y: 200}]}],
                powerUps: [{x: 400, y: 300, type: 'hover'}],
                theme: 'normal'
            }
        ];

        // Upgrades system
        let gravityKeys = 0;
        let upgrades = {
            ice: false,
            magnetic: false,
            zerog: false,
            hover: false
        };

        // Power-up effects
        let hoverTime = 0;
        let freezeTime = 0;
        let slowTime = 0;

        // Input handling
        const keys = {};
        let touchLeft = false;
        let touchRight = false;
        let touchFlip = false;

        // Event listeners
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (e.code === 'Space' && gameState === 'playing') {
                e.preventDefault();
                flipGravity();
            }
        });

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Mobile controls
        document.getElementById('leftBtn').addEventListener('touchstart', () => touchLeft = true);
        document.getElementById('leftBtn').addEventListener('touchend', () => touchLeft = false);
        document.getElementById('rightBtn').addEventListener('touchstart', () => touchRight = true);
        document.getElementById('rightBtn').addEventListener('touchend', () => touchRight = false);
        document.getElementById('flipBtn').addEventListener('touchstart', () => {
            touchFlip = true;
            flipGravity();
        });
        document.getElementById('flipBtn').addEventListener('touchend', () => touchFlip = false);

        // Prevent default touch behaviors
        document.addEventListener('touchstart', (e) => {
            if (e.target.classList.contains('mobile-btn')) {
                e.preventDefault();
            }
        });

        // Game functions
        function startGame() {
            gameState = 'playing';
            currentRoom = 1;
            score = 0;
            lives = 3;
            cellsCollected = 0;
            chainCount = 0;
            startTime = Date.now();
            gravity = 1;
            flipCooldown = 0;
            // Reset player
            player.x = 100;
            player.y = 300;
            player.vx = 0;
            player.vy = 0;
            player.onGround = false;
            // Reset power-ups
            hoverTime = 0;
            freezeTime = 0;
            slowTime = 0;
            loadRoom(currentRoom);
            showScreen('game');
            lastFrameTime = performance.now();
            requestAnimationFrame(gameLoop);
        }

        // --- Game Loop ---
        let lastFrameTime = 0;
        function gameLoop(timestamp) {
            const deltaTime = (timestamp - lastFrameTime) / 1000;
            lastFrameTime = timestamp;
            update(deltaTime);
            draw();
            requestAnimationFrame(gameLoop);
        }

        // --- Draw Function ---
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw cells
            cells.forEach(cell => {
                if (!cell.collected) {
                    ctx.save();
                    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(cell.glowPhase);
                    ctx.fillStyle = '#00ff00';
                    ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
                    ctx.restore();
                }
            });
            // Draw power-ups
            powerUps.forEach(powerUp => {
                if (!powerUp.collected) {
                    ctx.save();
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = '#ff00ff';
                    ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
                    ctx.restore();
                }
            });
            // Draw drones
            drones.forEach(drone => {
                ctx.save();
                ctx.fillStyle = drone.frozen ? '#00ffff' : '#ff0000';
                ctx.fillRect(drone.x, drone.y, drone.width, drone.height);
                ctx.restore();
            });
            // Draw lasers
            lasers.forEach(laser => {
                if (laser.active) {
                    ctx.save();
                    ctx.fillStyle = '#ff8800';
                    ctx.globalAlpha = 0.7;
                    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
                    ctx.restore();
                }
            });
            // Draw player
            ctx.save();
            ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.width, player.height);
            ctx.restore();
            // Draw particles
            particles.forEach(particle => {
                ctx.save();
                ctx.globalAlpha = particle.life;
                ctx.fillStyle = particle.color;
                ctx.fillRect(particle.x, particle.y, 4, 4);
                ctx.restore();
            });
            // Update HUD
            updateHUD();
        }

        // --- HUD Update Function ---
        function updateHUD() {
            // Score
            const scoreEl = document.getElementById('score');
            if (scoreEl) scoreEl.textContent = score;
            // Lives
            const livesEl = document.getElementById('lives');
            if (livesEl) livesEl.textContent = lives;
            // Cells
            const cellsEl = document.getElementById('cells');
            if (cellsEl) cellsEl.textContent = cellsCollected;
            // Room
            const roomEl = document.getElementById('room');
            if (roomEl) roomEl.textContent = currentRoom;
            // Time
            const timeEl = document.getElementById('time');
            if (timeEl) {
                if (gameState === 'playing') {
                    timeEl.textContent = Math.floor((Date.now() - startTime) / 1000);
                }
            }
        }

        function loadRoom(roomNumber) {
            const template = roomTemplates[(roomNumber - 1) % roomTemplates.length];
            
            // Clear existing objects
            cells = [];
            drones = [];
            lasers = [];
            debris = [];
            powerUps = [];
            particles = [];
            
            // Load cells
            template.cells.forEach(cell => {
                cells.push({
                    x: cell.x,
                    y: cell.y,
                    width: 15,
                    height: 15,
                    collected: false,
                    glowPhase: Math.random() * Math.PI * 2
                });
            });
            
            // Load drones
            if (template.drones) {
                template.drones.forEach(drone => {
                    drones.push({
                        x: drone.x,
                        y: drone.y,
                        width: 25,
                        height: 15,
                        path: drone.path,
                        pathIndex: 0,
                        speed: 50,
                        direction: 1,
                        frozen: false
                    });
                });
            }
            
            // Load lasers
            if (template.lasers) {
                template.lasers.forEach(laser => {
                    lasers.push({
                        x: laser.x,
                        y: laser.y,
                        width: laser.width,
                        height: laser.height,
                        interval: laser.interval,
                        active: true,
                        timer: 0
                    });
                });
            }
            
            // Load power-ups
            if (template.powerUps) {
                template.powerUps.forEach(powerUp => {
                    powerUps.push({
                        x: powerUp.x,
                        y: powerUp.y,
                        width: 20,
                        height: 20,
                        type: powerUp.type,
                        collected: false,
                        bobPhase: Math.random() * Math.PI * 2
                    });
                });
            }
        }

        function flipGravity() {
            if (flipCooldown <= 0 && hoverTime <= 0) {
                gravity *= -1;
                flipCooldown = maxFlipCooldown;
                
                // Add flip particles
                for (let i = 0; i < 10; i++) {
                    particles.push({
                        x: player.x + player.width / 2,
                        y: player.y + player.height / 2,
                        vx: (Math.random() - 0.5) * 200,
                        vy: (Math.random() - 0.5) * 200,
                        life: 1,
                        maxLife: 0.5,
                        color: '#00ffff'
                    });
                }
            }
        }

        function updatePlayer(deltaTime) {
            // Handle input
            const moveLeft = keys['ArrowLeft'] || keys['KeyA'] || touchLeft;
            const moveRight = keys['ArrowRight'] || keys['KeyD'] || touchRight;
            
            if (moveLeft) {
                player.vx = -player.speed;
            } else if (moveRight) {
                player.vx = player.speed;
            } else {
                player.vx = 0;
            }
            
            // Apply gravity (unless hovering)
            if (hoverTime <= 0) {
                player.vy += gravity * 800 * deltaTime;
            } else {
                // Hover mode - limited vertical control
                if (keys['ArrowUp'] || keys['KeyW']) {
                    player.vy = -100;
                } else if (keys['ArrowDown'] || keys['KeyS']) {
                    player.vy = 100;
                } else {
                    player.vy *= 0.9; // Gradual stop
                }
            }
            
            // Apply velocity
            player.x += player.vx * deltaTime;
            player.y += player.vy * deltaTime;
            
            // Collision with walls
            if (player.x < 0) {
                player.x = 0;
                player.vx = 0;
            } else if (player.x + player.width > canvas.width) {
                player.x = canvas.width - player.width;
                player.vx = 0;
            }
            
            // Collision with floor/ceiling
            player.onGround = false;
            if (player.y < 0) {
                player.y = 0;
                player.vy = 0;
                if (gravity === -1) player.onGround = true;
            } else if (player.y + player.height > canvas.height) {
                player.y = canvas.height - player.height;
                player.vy = 0;
                if (gravity === 1) player.onGround = true;
            }
            
            // Reset chain if touching ground
            if (player.onGround) {
                chainCount = 0;
            }
        }

        function updateCells(deltaTime) {
            cells.forEach(cell => {
                if (!cell.collected) {
                    cell.glowPhase += deltaTime * 3;
                    
                    // Check collision with player
                    if (player.x < cell.x + cell.width &&
                        player.x + player.width > cell.x &&
                        player.y < cell.y + cell.height &&
                        player.y + player.height > cell.y) {
                        
                        cell.collected = true;
                        cellsCollected++;
                        score += 5;
                        
                        // Chain bonus
                        const currentTime = Date.now();
                        if (currentTime - lastCellTime < 2000 && !player.onGround) {
                            chainCount++;
                            if (chainCount >= 3) {
                                score += chainCount * 2; // Chain bonus
                            }
                        } else {
                            chainCount = 1;
                        }
                        lastCellTime = currentTime;
                        
                        // Add collect particles
                        for (let i = 0; i < 8; i++) {
                            particles.push({
                                x: cell.x + cell.width / 2,
                                y: cell.y + cell.height / 2,
                                vx: (Math.random() - 0.5) * 150,
                                vy: (Math.random() - 0.5) * 150,
                                life: 1,
                                maxLife: 1,
                                color: '#00ff00'
                            });
                        }
                    }
                }
            });
        }

        function updateDrones(deltaTime) {
            drones.forEach(drone => {
                if (!drone.frozen) {
                    // Move along path
                    const target = drone.path[drone.pathIndex];
                    const dx = target.x - drone.x;
                    const dy = target.y - drone.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 5) {
                        drone.pathIndex = (drone.pathIndex + 1) % drone.path.length;
                    } else {
                        drone.x += (dx / distance) * drone.speed * deltaTime;
                        drone.y += (dy / distance) * drone.speed * deltaTime;
                    }
                }
                
                // Check collision with player
                if (player.x < drone.x + drone.width &&
                    player.x + player.width > drone.x &&
                    player.y < drone.y + drone.height &&
                    player.y + player.height > drone.y) {
                    
                    takeDamage();
                }
            });
        }

        function updateLasers(deltaTime) {
            lasers.forEach(laser => {
                laser.timer += deltaTime * 1000;
                laser.active = (laser.timer % laser.interval) < (laser.interval / 2);
                
                // Check collision with player when active
                if (laser.active &&
                    player.x < laser.x + laser.width &&
                    player.x + player.width > laser.x &&
                    player.y < laser.y + laser.height &&
                    player.y + player.height > laser.y) {
                    
                    takeDamage();
                }
            });
        }

        function updatePowerUps(deltaTime) {
            powerUps.forEach(powerUp => {
                if (!powerUp.collected) {
                    powerUp.bobPhase += deltaTime * 2;
                    
                    // Check collision with player
                    if (player.x < powerUp.x + powerUp.width &&
                        player.x + player.width > powerUp.x &&
                        player.y < powerUp.y + powerUp.height &&
                        player.y + player.height > powerUp.y) {
                        
                        powerUp.collected = true;
                        activatePowerUp(powerUp.type);
                    }
                }
            });
        }

        function activatePowerUp(type) {
            switch (type) {
                case 'hover':
                    hoverTime = upgrades.hover ? 8000 : 5000;
                    break;
                case 'freeze':
                    freezeTime = 3000;
                    drones.forEach(drone => drone.frozen = true);
                    break;
                case 'slow':
                    slowTime = 2000;
                    break;
            }
        }

        function updateParticles(deltaTime) {
            particles = particles.filter(particle => {
                particle.x += particle.vx * deltaTime;
                particle.y += particle.vy * deltaTime;
                particle.life -= deltaTime / particle.maxLife;
                return particle.life > 0;
            });
        }

        function takeDamage() {
            lives--;
            if (lives <= 0) {
                gameOver();
            } else {
                // Reset player position
                player.x = 100;
                player.y = 300;
                player.vx = 0;
                player.vy = 0;
                gravity = 1;
            }
        }

        function gameOver() {
            gameState = 'gameOver';
            
            // Calculate time bonus
            const timeElapsed = (Date.now() - startTime) / 1000;
            const timeBonus = Math.max(0, Math.floor((60 - timeElapsed) * 2));
            
            // Calculate keys earned
            const totalScore = score + timeBonus;
            const keysEarned = Math.floor(totalScore / 100);
            gravityKeys += keysEarned;
            
            // Update summary
            const summary = document.getElementById('runSummary');
            summary.innerHTML = `
                <div>Energy Cells: ${cellsCollected}</div>
                <div>Base Score: ${score}</div>
                <div>Time Bonus: +${timeBonus}</div>
                <div>Total Score: ${totalScore}</div>
                <div>Lives Remaining: ${lives}</div>
                <div style="color: #ff8800; font-size: 1.4rem;">Gravity Keys Earned: ${keysEarned}</div>
            `;
            
            showScreen('gameOver');
        }

        function update(deltaTime) {
            if (gameState !== 'playing') return;
            // Update cooldowns
            if (flipCooldown > 0) {
                flipCooldown -= deltaTime * 1000;
            }
            if (hoverTime > 0) {
                hoverTime -= deltaTime * 1000;
            }
            if (freezeTime > 0) {
                freezeTime -= deltaTime * 1000;
                if (freezeTime <= 0) {
                    drones.forEach(drone => drone.frozen = false);
                }
            }
            if (slowTime > 0) {
                slowTime -= deltaTime * 1000;
                deltaTime *= 0.5; // Slow motion effect
            }
            updatePlayer(deltaTime);
            updateCells(deltaTime);
            updateDrones(deltaTime);
            updateLasers(deltaTime);
            updatePowerUps(deltaTime);
            updateParticles(deltaTime);
            // Check for room completion
            const remainingCells = cells.filter(cell => !cell.collected).length;
            if (remainingCells === 0) {
                if (currentRoom < 5) {
                    currentRoom++;
                    loadRoom(currentRoom);
                } else {
                    gameOver();
                }
            }
        }

        // --- UI Screen Management ---
        function showScreen(screen) {
            const screens = ['titleScreen', 'instructionsScreen', 'upgradesScreen', 'gameOverScreen'];
            screens.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            if (screen === 'title') {
                document.getElementById('titleScreen').classList.remove('hidden');
            } else if (screen === 'instructions') {
                document.getElementById('instructionsScreen').classList.remove('hidden');
            } else if (screen === 'upgrades') {
                document.getElementById('upgradesScreen').classList.remove('hidden');
            } else if (screen === 'gameOver') {
                document.getElementById('gameOverScreen').classList.remove('hidden');
            }
        }

        function showUpgrades() {
            showScreen('upgrades');
        }

        function showInstructions() {
            showScreen('instructions');
        }

        function showTitle() {
            showScreen('title');
        }

        