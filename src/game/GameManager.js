const games = new Map();
const { createDeck, shuffleDeck } = require('./Deck');
const cardEmojis = require('./cardEmojis');
const { CREATURES, MORTAL_SETS, LOCATIONS } = require('./campyCreaturesData');
// Remove the problematic import from the top
// const { buildGameDisplay } = require('../commands/games/campy-creatures');

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// New location for the helper function, accessible by the whole module
const getTeenagerValue = (cardName) => {
    if (cardName.includes('One')) return 1;
    if (cardName.includes('Two')) return 2;
    if (cardName.includes('Three')) return 3;
    return 0;
};

const gameManager = {
    async updateDisplay(client, game, content) {
        if (!game.messageId) return;
        try {
            // Require the display builder function just-in-time to avoid circular dependency
            const { buildGameDisplay } = require('../commands/games/campy-creatures');

            const channel = await client.channels.fetch(game.channelId); // Đảm bảo đọc đúng channelId
            const message = await channel.messages.fetch(game.messageId);
            const replyOptions = await buildGameDisplay(client, game, content);
            await message.edit(replyOptions);
        } catch (e) {
            console.error("Lỗi nghiêm trọng khi cập nhật display:", e);
        }
    },

    createGame(channelId, gameType) {
        if (games.has(channelId)) {
            const existingGame = games.get(channelId);
            return { error: `Lỗi: Đã có một game ${existingGame.gameType} đang diễn ra trong kênh này.` };
        }

        // Base properties for any game
        let game = {
            channelId: channelId,
            gameType: gameType,
            messageId: null,
            players: [],
            gameState: 'waiting',
            lastActivity: Date.now(),
        };

        // Add properties specific to the game type
        if (gameType === 'campy-creatures') {
            Object.assign(game, {
                round: 0,
                turnNumber: 0,
                clashOMeter: [],
                mortalDeck: [],
                locationDeckRewards: [],
                locationDeckFinalActs: [],
                mortalsOnTable: [],
                activeLocation: null,
                discardPile: { // THUỘC TÍNH BỊ THIẾU GÂY RA LỖI
                    creatures: [],
                    mortals: []
                },
                captureOrder: [],
                capturingPlayerIndex: 0,
                turnPhase: 'choosing',
                clashWinnerForTurn: null,
                teenagerRankings: null,
            });
        } else { // Defaults to flip7 structure
            Object.assign(game, {
                deck: [],
                currentPlayerIndex: 0,
                roundData: {},
                voteToEnd: null,
            });
        }

        games.set(channelId, game);
        return { game };
    },

    startGame(game) {
        if (!game || game.gameType !== 'campy-creatures') return;

        game.gameState = 'in-progress';
        game.round = 1;
        game.turnNumber = 1;

        game.clashOMeter = shuffleArray([...game.players.map(p => p.id)]);
        game.clashWinnerForTurn = null; 

        // Create shuffled location decks for the entire game
        game.locationDeckRewards = shuffleArray([...LOCATIONS.REWARDS]);
        game.locationDeckFinalActs = shuffleArray([...LOCATIONS.FINAL_ACTS]);

        game.players.forEach(p => {
            p.creatureHand = [...CREATURES];
            p.creatureDiscard = []; 
            p.roundCapturedMortals = [];
            p.persistentMortals = [];
            p.conqueredLocations = [];
            p.totalScore = 0;
        });
        
        game.mortalDeck = this.setupMortalDeck(game.players.length);
        
        // Draw the first location for Round 1
        game.activeLocation = game.locationDeckRewards.pop();
        
        game.turnPhase = 'choosing';
        game.mortalsOnTable = [];
        if (game.mortalDeck.length >= game.players.length) {
            for(let i = 0; i < game.players.length; i++) {
                if(game.mortalDeck.length > 0) {
                    game.mortalsOnTable.push(game.mortalDeck.pop());
                }
            }
        }
        
        return { success: true };
    },

    startRound(game) {
        // --- Cleanup from the previous round ---
        game.players.forEach(p => {
            // Player keeps their persistent Mortals (Assistants)
            // All other captured mortals from the round are discarded.
            p.roundCapturedMortals = [];
            
            // Player gets their full creature deck back
            p.creatureHand = [...CREATURES];
            p.creatureDiscard = [];
        });

        // --- Setup for the new round ---
        game.round++;
        game.turnNumber = 0; // Will become 1 in startTurn
        game.gameState = 'in-progress';
        
        game.mortalDeck = this.setupMortalDeck(game.players.length);

        if (game.round < 3) {
            const availableLocations = [...LOCATIONS.REWARDS];
            game.activeLocation = shuffleArray(availableLocations)[0];
        } else {
            const availableLocations = [...LOCATIONS.FINAL_ACTS];
            game.activeLocation = shuffleArray(availableLocations)[0];
        }
        
        this.startTurn(game);
    },

    startNextRound(game) {
        // --- Cleanup from the previous round ---
        game.players.forEach(p => {
            p.roundCapturedMortals = [];
            p.creatureHand = [...CREATURES];
            p.creatureDiscard = [];
        });

        // --- Setup for the new round ---
        game.round++;
        game.turnNumber = 0; // It will be incremented to 1 by startTurn
        game.gameState = 'in-progress';
        
        game.mortalDeck = this.setupMortalDeck(game.players.length);

        // Draw the next unique location for the new round
        if (game.round < 3) {
            game.activeLocation = game.locationDeckRewards.pop();
        } else {
            game.activeLocation = game.locationDeckFinalActs.pop();
        }
        
        // Start the first turn of the new round
        this.startTurn(game);
    },

    calculateRoundScores(game, locationWinnerId) {
        const log = ['\n### Bảng Điểm Vòng'];
        
        game.players.forEach(p => {
            const scoreBreakdown = [];
            let totalRoundScore = 0;

            // --- Quái vật trên tay ---
            if (p.creatureHand.length > 0) {
                let creatureScore = p.creatureHand.reduce((sum, creature) => sum + creature.strength, 0);
                let beastBonusText = '';
                if (p.creatureHand.some(c => c.name === 'The Beast')) {
                    creatureScore += 3;
                    beastBonusText = ' + 3 bonus';
                }
                if (creatureScore > 0) {
                    const creatureHandNames = p.creatureHand.map(c => c.name).join(', ');
                    scoreBreakdown.push(`Quái vật trên tay: +${creatureScore} (*${creatureHandNames}${beastBonusText}*)`);
                    totalRoundScore += creatureScore;
                }
            }

            // --- Classics ---
            const classicCards = p.roundCapturedMortals.filter(m => m.type === 'classic');
            if (classicCards.length > 0) {
                const classicScore = classicCards.reduce((sum, m) => sum + m.points, 0);
                if (classicScore !== 0) {
                    scoreBreakdown.push(`Classics: ${classicScore > 0 ? '+' : ''}${classicScore}`);
                    totalRoundScore += classicScore;
                }
            }

            // --- Engineers ---
            const engineers = p.roundCapturedMortals.filter(m => m.type === 'engineer');
            if (engineers.length > 0) {
                const isOdd = engineers.length % 2 !== 0;
                const pointsPerEngineer = isOdd ? -2 : 3;
                const engineerTotal = engineers.length * pointsPerEngineer;
                scoreBreakdown.push(`Engineers: ${engineerTotal > 0 ? '+' : ''}${engineerTotal} (*${engineers.length} lá*)`);
                totalRoundScore += engineerTotal;
            }

            // --- Teenagers (will be added after comparison) ---
            let teenagerScore = 0;
            const teenagerValue = p.roundCapturedMortals
                .filter(m => m.type === 'teenager')
                .reduce((sum, card) => sum + getTeenagerValue(card.name), 0);

            if (p.id === game.teenagerRankings?.first) {
                teenagerScore = 7;
                scoreBreakdown.push(`Teenagers (nhiều nhất - ${teenagerValue} điểm): +7`);
            } else if (p.id === game.teenagerRankings?.second) {
                teenagerScore = 4;
                scoreBreakdown.push(`Teenagers (thứ 2 - ${teenagerValue} điểm): +4`);
            }
            totalRoundScore += teenagerScore;
            
            // --- Final Log Update ---
            p.totalScore += totalRoundScore;
            log.push(`\n**${p.username}** (+${totalRoundScore} điểm, Tổng: ${p.totalScore})`);
            if (scoreBreakdown.length > 0) {
                log.push(...scoreBreakdown.map(line => `> - ${line}`));
            } else {
                log.push('> - *Không ghi thêm điểm từ bài trong vòng này.*');
            }
        });

        // --- Assistant Handling ---
        game.players.forEach(p => {
            const newAssistants = p.roundCapturedMortals.filter(m => m.type === 'assistant');
            if (newAssistants.length > 0) {
                p.persistentMortals.push(...newAssistants);
            }
            if (p.conqueredLocations.some(loc => loc.name === 'The Secret Lab') && !p.persistentMortals.some(m => m.name === 'The Secret Lab')) {
                 p.persistentMortals.push({ name: 'The Secret Lab', type: 'assistant' });
            }

            // CRITICAL FIX: After moving assistants, re-assign roundCapturedMortals
            // to only contain non-assistant cards from that round.
            // This is crucial for the "View Captured" button to work correctly before the next round starts.
            p.roundCapturedMortals = p.roundCapturedMortals.filter(m => m.type !== 'assistant');
        });
        
        return log.join('\n');
    },

    endRound(game, client) {
        let log = [`\n# Vòng ${game.round} Kết Thúc!`];
        
        if(game.mortalDeck.length > 0) {
            log.push(`> Lá Mortal cuối cùng, **${game.mortalDeck[0].name}**, đã trốn thoát!`);
        }

        // --- Step 1: Conquer Location ---
        let highestIconCount = -1;
        let potentialWinners = [];
        game.players.forEach(p => {
            const iconCount = p.roundCapturedMortals.reduce((sum, mortal) => sum + (mortal.locationIcon || 0), 0);
            if (iconCount > highestIconCount) {
                highestIconCount = iconCount;
                potentialWinners = [p.id];
            } else if (iconCount === highestIconCount && iconCount > 0) {
                potentialWinners.push(p.id);
            }
        });

        let locationWinnerId = null;
        if (potentialWinners.length === 1) {
            locationWinnerId = potentialWinners[0];
        } else if (potentialWinners.length > 1) {
            locationWinnerId = game.clashOMeter.find(id => potentialWinners.includes(id));
        }

        if (locationWinnerId) {
            const locationWinner = game.players.find(p => p.id === locationWinnerId);
            locationWinner.conqueredLocations.push(game.activeLocation);
            log.push(`**${locationWinner.username}** đã chinh phục được Location: **${game.activeLocation.name}**!`);
            
            if (game.activeLocation.name === 'The Metropolis') {
                locationWinner.totalScore += 2;
                const winnerIndex = game.clashOMeter.indexOf(locationWinner.id);
                if (winnerIndex > -1) {
                    const [winnerId] = game.clashOMeter.splice(winnerIndex, 1);
                    game.clashOMeter.unshift(winnerId);
                    log.push(`> **${locationWinner.username}** leo lên đỉnh Clash-O-Meter và nhận 2 điểm!`);
                }
            }
        } else {
            log.push('> Không ai chinh phục được Location vòng này.');
        }

        // --- Step 2: Rank Teenagers BEFORE calculating scores ---
        const teenagerCounts = game.players.map(p => {
            let count = p.roundCapturedMortals
                .filter(m => m.type === 'teenager')
                .reduce((sum, card) => sum + getTeenagerValue(card.name), 0);
            if (p.id === locationWinnerId && game.activeLocation.name === 'Camp Murkwood') {
                count += getTeenagerValue('Two Teenagers');
                log.push(`> **${p.username}** dùng hiệu ứng Camp Murkwood, nhận thêm 2 điểm Teenager!`);
            }
            return { id: p.id, count: count };
        }).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return game.clashOMeter.indexOf(a.id) - game.clashOMeter.indexOf(b.id);
        });
        
        game.teenagerRankings = {
            first: teenagerCounts[0]?.count > 0 ? teenagerCounts[0].id : null,
            second: teenagerCounts.length > 1 && teenagerCounts[1]?.count > 0 ? teenagerCounts[1].id : null
        };

        // --- Step 3: Calculate Scores ---
        const scoringLog = this.calculateRoundScores(game, locationWinnerId);
        log.push(scoringLog);

        // --- Step 4: Check for Game End ---
        if (game.round >= 3) {
            log.push('\n# 🏁 TRÒ CHƠI KẾT THÚC! 🏁');
            const finalStandings = [...game.players].sort((a, b) => {
                if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                return game.clashOMeter.indexOf(a.id) - game.clashOMeter.indexOf(b.id);
            });
            const winner = finalStandings[0];
            log.push(`\n## 🏆 Người chiến thắng cuối cùng là **${winner.username.toUpperCase()}** với **${winner.totalScore}** điểm! 🏆`);
            finalStandings.forEach((p, index) => {
                log.push(`${index + 1}. **${p.username}** - ${p.totalScore} điểm`);
            });
            game.gameState = 'finished';
        } else {
            // New state: end_of_round
            game.gameState = 'end_of_round';
            log.push(`\n**Chủ phòng hãy nhấn nút bên dưới để bắt đầu Vòng ${game.round + 1}...**`);
        }
        
        return log.join('\n');
    },

    async resolveTurn(game, client) {
        // --- STEP 1: Determine Initial Action Order ---
        // First, calculate everyone's initial strength
        game.players.forEach(p => {
            if (p.playedCreature) {
                p.finalStrength = p.playedCreature.strength;
            } else {
                p.finalStrength = 0;
            }
        });

        // Determine the initial action order based on initial strength
        let initialActionOrder = [];
        const playersWhoPlayed = game.players.filter(p => p.playedCreature);
        const strengthGroups = playersWhoPlayed.reduce((groups, player) => {
            const key = player.finalStrength ?? -1;
            if (!groups[key]) { groups[key] = []; }
            groups[key].push(player);
            return groups;
        }, {});
        
        const sortedStrengths = Object.keys(strengthGroups).sort((a, b) => b - a);
        for (const strength of sortedStrengths) {
            let playersInGroup = strengthGroups[strength];
            if (playersInGroup.length > 1) {
                playersInGroup.sort((a, b) => game.clashOMeter.indexOf(a.id) - game.clashOMeter.indexOf(b.id));
            }
            initialActionOrder.push(...playersInGroup);
        }

        // --- STEP 2: Activate 'Reveal' Abilities IN THE CORRECT ORDER ---
        const turnLog = ['**Lượt được giải quyết!**'];
        turnLog.push(`- Kích hoạt kỹ năng Giai đoạn Lật bài:`);

        for (const player of initialActionOrder) {
            if (player.abilityDisabled) {
                turnLog.push(`- Kỹ năng của **${player.playedCreature.name}** (${player.username}) đã bị vô hiệu hóa!`);
                continue;
            }

            if (player.playedCreature?.activationPhase === 'reveal') {
                switch (player.playedCreature.name) {
                    case 'The Vampire': {
                        const clashOMeterOrder = game.clashOMeter;
                        const vampireIndex = clashOMeterOrder.indexOf(player.id);
                        const playerToLeftId = clashOMeterOrder[(vampireIndex + clashOMeterOrder.length - 1) % clashOMeterOrder.length];
                        const playerToLeft = game.players.find(p => p.id === playerToLeftId);

                        if (playerToLeft?.playedCreature) {
                            turnLog.push(`- **The Vampire** của **${player.username}** đã vô hiệu hóa kỹ năng của **${playerToLeft.username}**!`);
                            playerToLeft.abilityDisabled = true;
                        }
                        break;
                    }
                    // The Mummy and Blob 'reveal' abilities are contextual and handled later.
                }
            }
        }
        
        // --- STEP 3: Handle The Blob's Absorption (if not disabled) ---
        const blobPlayer = game.players.find(p => p.playedCreature?.name === 'The Blob' && !p.absorbedCreature);

        if (blobPlayer && !blobPlayer.abilityDisabled) {
            // The Blob needs to absorb, and its ability is active. Pause the game.
            game.turnPhase = 'waiting_for_blob';
            const revealedLog = game.players
                .map(p => p.playedCreature ? `- **${p.username}** đã lật bài **${p.playedCreature.name}**.` : null)
                .filter(Boolean).join('\n');
            const waitingLog = `Chờ **${blobPlayer.username}** chọn Quái vật để hấp thụ!`;
            const content = `**Tất cả người chơi đã lật bài!**\n${revealedLog}\n\n${waitingLog}`;
            await this.updateDisplay(client, game, content);
            return; // EXIT here and wait for Blob player's interaction.
        }
        
        // --- STEP 4: Recalculate Final Strengths & Determine Final Capture Order ---
        // If we reach here, The Blob has either already absorbed, is disabled, or wasn't played.
        const clashLog = [];
        
        game.players.forEach(p => {
            if (p.playedCreature?.name === 'The Blob') {
                if (p.abilityDisabled) {
                    // Add this log to inform the player
                    turnLog.push(`- Kỹ năng hấp thụ của **The Blob** (${p.username}) đã bị vô hiệu hóa! Sức mạnh vẫn là 0.`);
                } else if (p.absorbedCreature) {
                    p.finalStrength = p.absorbedCreature.strength;
                    if (!turnLog.some(l => l.includes('hấp thụ'))) { // Avoid duplicate logs
                        turnLog.push(`- **${p.username}** chơi **The Blob**, hấp thụ **${p.absorbedCreature.name}** (Sức mạnh cuối: ${p.finalStrength}).`);
                    }
                }
            }
        });

        // Determine final capture order (This logic is now for both sorting and clash detection)
        let finalOrder = [];
        const finalStrengthGroups = playersWhoPlayed.reduce((groups, player) => {
            const key = player.finalStrength ?? -1;
            if (!groups[key]) { groups[key] = []; }
            groups[key].push(player);
            return groups;
        }, {});
        
        let highestClashStrength = -1;
        const finalSortedStrengths = Object.keys(finalStrengthGroups).sort((a, b) => b - a);

        for (const strength of finalSortedStrengths) {
            let playersInGroup = finalStrengthGroups[strength];
            if (playersInGroup.length > 1) {
                clashLog.push(`- Clash giữa những người chơi có sức mạnh ${strength}!`);
                playersInGroup.sort((a, b) => game.clashOMeter.indexOf(a.id) - game.clashOMeter.indexOf(b.id));
                if (parseInt(strength, 10) > highestClashStrength) {
                    highestClashStrength = parseInt(strength, 10);
                    game.clashWinnerForTurn = playersInGroup[0].id;
                    clashLog.push(`- **${playersInGroup[0].username}** thắng trong cuộc Clash!`);
                }
            }
            finalOrder.push(...playersInGroup);
        }
        finalOrder.sort((a, b) => b.finalStrength - a.finalStrength);

        // --- STEP 5: Handle Post-Sort Abilities (The Mummy) ---
        const mummyPlayerForEffect = finalOrder.find(p => p.playedCreature?.name === 'The Mummy' && !p.abilityDisabled);
        const kaijuIsPlayed = finalOrder.some(p => p.playedCreature?.name === 'The Kaiju');
        
        if (mummyPlayerForEffect && kaijuIsPlayed) {
            turnLog.push(`- **Kaiju** đã xuất hiện! **The Mummy** của **${mummyPlayerForEffect.username}** được ưu tiên bắt mồi trước!`);
            const mummyIndex = finalOrder.findIndex(p => p.id === mummyPlayerForEffect.id);
            if (mummyIndex > -1) {
                const [mummyObject] = finalOrder.splice(mummyIndex, 1);
                finalOrder.unshift(mummyObject);
            }
        }
        
        // --- Finalize ---
        game.captureOrder = finalOrder.map(p => p.id);
        game.turnPhase = 'capturing';
        game.capturingPlayerIndex = 0;

        const resolutionLog = `**Thứ tự bắt Mortal:**\n${finalOrder.map((player, index) => `${index + 1}. ${player.username} (Sức mạnh: ${player.finalStrength})`).join('\n')}`;
        await this.updateDisplay(client, game, `${turnLog.join('\n')}\n\n${clashLog.join('\n')}\n\n${resolutionLog}`);
    },

    advanceToNextCapturer(game, client) {
        if (game.capturingPlayerIndex >= game.captureOrder.length - 1) {
            // All players have captured, end the turn
            const endTurnLog = this.startTurn(game);
            if (endTurnLog.endRound) {
                this.updateDisplay(client, game, endTurnLog.log);
            } else {
                 this.updateDisplay(client, game, "Lượt mới đã bắt đầu!");
            }
        } else {
            game.capturingPlayerIndex++;
            this.updateDisplay(client, game, "Đến lượt người tiếp theo bắt mồi...");
        }
    },

    async processCapture(game, client, capturingPlayer, chosenMortal) {
        // Step 1: Standard capture
        const mortalIndex = game.mortalsOnTable.findIndex(m => m.name === chosenMortal.name);
        if (mortalIndex === -1) return; // Should not happen

        game.mortalsOnTable.splice(mortalIndex, 1);

        // Step 2: Check for post-capture abilities
        const creatureAbility = capturingPlayer.playedCreature?.name;

        if (creatureAbility === 'The Swamp Creature' && !capturingPlayer.abilityDisabled) {
            capturingPlayer.pendingCapturedMortal = chosenMortal; // Temporarily hold the mortal
            game.turnPhase = 'swamp_creature_give';
            await this.updateDisplay(client, game, `**${capturingPlayer.username}** đã bắt được **${chosenMortal.name}** và phải đưa nó cho người chơi khác!`);
            return; // <-- ADD THIS RETURN
        }

        // If not Swamp Creature, give mortal directly
        capturingPlayer.roundCapturedMortals.push(chosenMortal);

        // After regular capture is done, check for other abilities
        if (creatureAbility === 'The Werewolf' && !capturingPlayer.abilityDisabled) {
            const clashOMeterOrder = game.clashOMeter;
            const werewolfIndex = clashOMeterOrder.indexOf(capturingPlayer.id);
            const playerToRightId = clashOMeterOrder[(werewolfIndex + 1) % clashOMeterOrder.length];
            
            game.turnPhase = 'werewolf_discard';
            game.werewolfAttackerId = capturingPlayer.id; // Store who is the attacker
            game.werewolfVictimId = playerToRightId; // Store who needs to discard

            const attacker = game.players.find(p => p.id === capturingPlayer.id);
            const victim = game.players.find(p => p.id === playerToRightId);
            // Pass the client object correctly
            await this.updateDisplay(client, game, `**${attacker.username}** đã bắt **${chosenMortal.name}**. Kỹ năng của **The Werewolf** được kích hoạt! Chờ **${attacker.username}** chọn một lá bài từ tay của **${victim.username}** để loại bỏ...`);
            return; // <-- ADD THIS RETURN
        }

        // If no special abilities triggered, advance to the next player
        this.advanceToNextCapturer(game, client);
    },

    setupMortalDeck(playerCount) {
        let mortalDeck = [];
        const setsToUse = ['CLASSICS', 'TEENAGERS', 'ENGINEERS'];
        shuffleArray(setsToUse); // Randomize which sets are chosen

        let setsForGame = [];
        let cardsPerSet = 0;
        let assistantCount = 0;

        if (playerCount === 2) {
            setsForGame = [setsToUse[0]];
            cardsPerSet = 4;
            assistantCount = 2;
        } else if (playerCount === 3) {
            setsForGame = [setsToUse[0], setsToUse[1]];
            cardsPerSet = 5;
            assistantCount = 2;
        } else if (playerCount === 4) {
            setsForGame = [setsToUse[0], setsToUse[1], setsToUse[2]];
            cardsPerSet = 5;
            assistantCount = 3;
        } else if (playerCount >= 5) {
            setsForGame = ['CLASSICS', 'TEENAGERS', 'ENGINEERS'];
            cardsPerSet = -1; // -1 means all cards
            assistantCount = 3;
        }
        
        // Add cards from chosen sets
        for (const setName of setsForGame) {
            const fullSet = shuffleArray([...MORTAL_SETS[setName]]);
            const cardsToAdd = cardsPerSet === -1 ? fullSet : fullSet.slice(0, cardsPerSet);
            mortalDeck.push(...cardsToAdd);
        }

        // Add Assistants
        const assistants = shuffleArray([...MORTAL_SETS.ASSISTANTS]);
        mortalDeck.push(...assistants.slice(0, assistantCount));

        return shuffleArray(mortalDeck);
    },

    startTurn(game) {
        if (game.mortalDeck.length <= 1) {
            const endRoundLog = this.endRound(game);
            return { endRound: true, log: endRoundLog };
        }

        // --- Clash-O-Meter Adjustment from PREVIOUS turn ---
        if (game.clashWinnerForTurn) {
            const winnerIndex = game.clashOMeter.indexOf(game.clashWinnerForTurn);
            if (winnerIndex > -1) {
                const [winnerId] = game.clashOMeter.splice(winnerIndex, 1);
                game.clashOMeter.push(winnerId);
            }
            game.clashWinnerForTurn = null; // Reset for the new turn
        }

        // --- Cleanup from previous turn ---
        game.players.forEach(p => {
            p.playedCreature = null;
            p.absorbedCreature = null; // Reset absorbed creature
            p.finalStrength = 0;
            p.abilityDisabled = false; // Reset the disabled flag
        });

        game.turnNumber++;
        game.turnPhase = 'choosing';
        game.mortalsOnTable = [];
        for(let i = 0; i < game.players.length; i++) {
            if(game.mortalDeck.length > 0) {
                game.mortalsOnTable.push(game.mortalDeck.pop());
            }
        }
        
        return { endRound: false };
    },

    getGame(channelId) {
        return games.get(channelId);
    },

    endGame(channelId) {
        if (!games.has(channelId)) {
            return { error: 'Không có ván game nào đang diễn ra ở kênh này.' };
        }
        games.delete(channelId);
        return { success: true };
    },

    drawCard(game) {
        if (!game.deck || game.deck.length === 0) {
            console.log('Bộ bài rỗng. Tạo lại và xáo bài.');
            const newDeck = createDeck();
            game.deck = shuffleDeck(newDeck);
        }
        return game.deck.pop();
    },

    getAllGames() {
        return games;
    },

    startRound(game) {
        game.gameState = 'in-progress';
        game.deck = shuffleDeck(createDeck());
        game.currentPlayerIndex = 0;
        
        const initialMessages = [];

        game.players.forEach(p => {
            p.hand = [];
            p.score = 0;
            p.hasStayed = false;
            p.isBusted = false;
            
            const card = this.drawCard(game);
            p.hand.push(card);
            
            let message = `**${p.username}** bắt đầu với lá ${cardEmojis[card.name] || `~${card.name}~`}.`;

            // Handle special cards for the first draw
            if (card.name === 'Freeze') {
                p.hasStayed = true;
                message += `\n> ❄️ Dính **Freeze** và bị mất lượt vòng này!`;
            } else if (card.name === 'Flip Three') {
                const extraCards = [];
                for (let i = 0; i < 3; i++) {
                    const extraCard = this.drawCard(game);
                    if (extraCard) {
                        p.hand.push(extraCard);
                        extraCards.push(cardEmojis[extraCard.name] || `~${extraCard.name}~`);
                    }
                }
                message += `\n> 🃏 Rút trúng **Flip Three** và nhận thêm 3 lá: ${extraCards.join(' ')}`;
            }

            // After dealing, check for BUST condition
            const numberCardsInHand = p.hand.filter(c => c.type === 'number');
            const hasDuplicate = new Set(numberCardsInHand.map(c => c.value)).size !== numberCardsInHand.length;

            if (hasDuplicate) {
                const secondChanceIndex = p.hand.findIndex(c => c.name === 'Second Chance');
                if (secondChanceIndex !== -1) {
                    message += `\n> ✨ Suýt **BUST**! nhưng đã được **Second Chance** cứu!`;
                    p.hand.splice(secondChanceIndex, 1);
                    const cardValues = numberCardsInHand.map(c => c.value);
                    const duplicateValue = cardValues.find((v, i) => cardValues.indexOf(v) !== i);
                    const firstIndex = p.hand.findIndex(c => c.value === duplicateValue);
                    if (firstIndex > -1) p.hand.splice(firstIndex, 1);
                    const secondIndex = p.hand.findIndex(c => c.value === duplicateValue);
                    if (secondIndex > -1) p.hand.splice(secondIndex, 1);
                } else {
                    message += `\n> 💀 **BUST!** Bạn đã có cặp bài trùng khi bắt đầu.`;
                    p.isBusted = true;
                    p.score = 0;
                }
            }
            
            initialMessages.push(message);
        });

        // Logic to skip frozen/busted players at the start
        let attempts = 0;
        while (
            (game.players[game.currentPlayerIndex].hasStayed || game.players[game.currentPlayerIndex].isBusted) &&
            attempts < game.players.length
        ) {
            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
            attempts++;
        }
        
        return initialMessages;
    }
};

module.exports = gameManager; 