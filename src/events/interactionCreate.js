const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const gameManager = require('../game/GameManager');
const { updateGameDisplay } = require('../commands/games/flip7');
const { createDeck, shuffleDeck } = require('../game/Deck');
const cardEmojis = require('../game/cardEmojis');
const { CREATURES, MORTAL_SETS, LOCATIONS } = require('../game/campyCreaturesData');
const { buildGameDisplay } = require('../commands/games/campy-creatures');

// Helper function to calculate score based on hand
function calculateRoundScore(hand) {
    let score = 0;
    const numberCards = hand.filter(c => c.type === 'number');
    const modifierCards = hand.filter(c => c.type === 'modifier');
    let hasX2 = false;

    // 1. Sum number cards
    score = numberCards.reduce((sum, card) => sum + card.value, 0);

    // 2. Handle modifiers
    modifierCards.forEach(mod => {
        if (mod.name === 'x2') {
            hasX2 = true;
        } else {
            score += mod.value;
        }
    });

    // 3. Apply x2 multiplier
    if (hasX2) {
        score *= 2;
    }

    return score;
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                // Attach client to the game object upon creation for consistent access
                if (interaction.commandName === 'campy-creatures' && interaction.options.getSubcommand() === 'start') {
                    const { game: newGame, error } = gameManager.createGame(interaction.channelId, 'campy-creatures');
                    if (error) {
                        return interaction.reply({ content: error, ephemeral: true });
                    }
                    newGame.client = interaction.client; // <-- THE CRITICAL FIX
                    const host = interaction.user;
                    newGame.players.push({ id: host.id, username: host.username, isHost: true, creatureHand: [...CREATURES], creatureDiscard: [], roundCapturedMortals: [], persistentMortals: [], conqueredLocations: [], totalScore: 0 });
                    
                    const replyOptions = await command.buildGameDisplay(interaction.client, newGame, `Phòng chơi được tạo bởi **${host.username}**!`);
                    await interaction.reply(replyOptions);
                    const message = await interaction.fetchReply();
                    if (message) {
                        newGame.messageId = message.id;
                    }
                    return; // Exit after handling the start command
                }

                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            const game = gameManager.getGame(interaction.channelId);
            if (!game) {
                return interaction.reply({ content: 'Không có phòng chơi nào đang hoạt động ở kênh này. Dùng `/flip7 start` hoặc `/campy-creatures start` để tạo phòng.', ephemeral: true });
            }
            game.lastActivity = Date.now();

            // --- Campy Creatures Lobby Buttons ---
            if (interaction.customId.startsWith('campy_creatures_')) {
                if (game.gameType !== 'campy-creatures') {
                    return interaction.reply({ content: 'Lỗi: Tương tác này dành cho game Campy Creatures, nhưng phòng hiện tại là game khác.', ephemeral: true });
                }

                if (interaction.customId === 'campy_creatures_show_hand') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player) {
                        return interaction.reply({ content: 'Bạn không có trong ván game này.', ephemeral: true });
                    }
                    if (player.playedCreature) {
                        return interaction.reply({ content: `Bạn đã chọn **${player.playedCreature.name}** cho lượt này rồi.`, ephemeral: true });
                    }

                    if (!player.creatureHand || player.creatureHand.length === 0) {
                        return interaction.reply({ content: 'Bạn không còn quái vật nào trên tay để chọn!', ephemeral: true });
                    }

                    const creatureButtons = player.creatureHand.map(creature => 
                        new ButtonBuilder()
                            .setCustomId(`campy_creatures_play_${creature.name}`) // Sửa ở đây: không xóa dấu cách nữa
                            .setLabel(`${creature.name} (${creature.strength})`)
                            .setStyle(ButtonStyle.Secondary)
                    );
                    
                    const rows = [];
                    for (let i = 0; i < creatureButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(creatureButtons.slice(i, i + 5)));
                    }

                    return interaction.reply({
                        content: 'Hãy chọn một Quái vật từ tay của bạn:',
                        components: rows,
                        ephemeral: true,
                    });
                }

                if (interaction.customId === 'campy_creatures_join') {
                    if (game.gameState !== 'waiting') {
                        return interaction.reply({ content: 'Rất tiếc, ván game đã bắt đầu. Bạn không thể tham gia nữa.', ephemeral: true });
                    }
                    if (game.players.find(p => p.id === interaction.user.id)) {
                        return interaction.reply({ content: 'Bạn đã ở trong phòng chơi rồi.', ephemeral: true });
                    }
                    if (game.players.length >= 5) {
                        return interaction.reply({ content: 'Rất tiếc, phòng đã đủ 5 người chơi.', ephemeral: true });
                    }
                    const newUser = interaction.user;
                    game.players.push({ id: newUser.id, username: newUser.username, isHost: false });
                    await interaction.deferUpdate();
                    await gameManager.updateDisplay(interaction.client, game, `**${newUser.username}** đã tham gia!`);
                    return;
                }

                if (interaction.customId === 'campy_creatures_leave') {
                    const playerIndex = game.players.findIndex(p => p.id === interaction.user.id);
                    if (playerIndex === -1) {
                        return interaction.reply({ content: 'Bạn không có trong phòng chơi này.', ephemeral: true });
                    }
                    const leavingUser = game.players[playerIndex];
                    game.players.splice(playerIndex, 1);
                    
                    await interaction.deferUpdate();

                    if (game.players.length === 0) {
                        gameManager.endGame(interaction.channelId);
                        
                        const endContainer = new ContainerBuilder();
                        const endText = new TextDisplayBuilder().setContent(
                            `# Phòng chơi đã giải tán\n**${leavingUser.username}** đã rời phòng, và là người cuối cùng.\n\nDùng \`/campy-creatures start\` để tạo phòng mới!`
                        );
                        endContainer.addTextDisplayComponents(endText);

                        try {
                            await interaction.editReply({ 
                            flags: MessageFlags.IsComponentsV2,
                            components: [endContainer] 
                        });
                        } catch (e) {
                             // This can happen if the original message was deleted.
                            console.error("Error editing reply on game end:", e);
                        }

                        return;
                    }

                    let content = `**${leavingUser.username}** đã rời khỏi phòng.`;
                    if (leavingUser.isHost && game.players.length > 0) {
                        game.players[0].isHost = true;
                        content = `**${leavingUser.username}** đã rời phòng. **${game.players[0].username}** là chủ phòng mới.`;
                    }
                    await gameManager.updateDisplay(interaction.client, game, content);
                    return;
                }
                
                if (interaction.customId === 'campy_creatures_begin') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player || !player.isHost) {
                        return interaction.reply({ content: 'Chỉ có chủ phòng mới có thể bắt đầu ván game.', ephemeral: true });
                    }
                    if (game.gameState === 'in-progress') {
                        return interaction.reply({ content: 'Ván game đã bắt đầu rồi.', ephemeral: true });
                    }
                    if (game.players.length < 2) { 
                        return interaction.reply({ content: 'Cần có ít nhất 2 người chơi để bắt đầu.', ephemeral: true });
                    }
                    
                    gameManager.startGame(game);
                    await interaction.deferUpdate();
                    await gameManager.updateDisplay(interaction.client, game, `Ván đấu bắt đầu! Chúc may mắn, các nhà khoa học điên!`);
                    return;
                }

                if (interaction.customId.startsWith('campy_creatures_play_')) {
                    // This interaction comes from the ephemeral message with hand buttons.
                    const creatureName = interaction.customId.substring('campy_creatures_play_'.length);

                    // First, update the ephemeral message to close it.
                    await interaction.update({ content: `Bạn đã chọn **${creatureName}**.`, components: [] });

                    // Now, find the game and update the main game state.
                    const game = gameManager.getGame(interaction.channelId);
                    if (!game) return; // Should not happen if the button was clicked.

                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player || player.playedCreature) {
                        return; // Player already played or is not in game.
                    }

                    const creatureIndex = player.creatureHand.findIndex(c => c.name === creatureName);
                    if (creatureIndex === -1) {
                        // This case should be rare now, but good to have a fallback.
                        console.error(`Lỗi logic: Không tìm thấy ${creatureName} trên tay ${player.username} dù nút đã được nhấn.`);
                        return;
                    }

                    const creatureToPlay = player.creatureHand[creatureIndex];
                    player.creatureHand.splice(creatureIndex, 1);
                    player.playedCreature = creatureToPlay;

                    const allPlayersReady = game.players.every(p => p.playedCreature);

                    if (allPlayersReady) {
                        // Since the original interaction is now closed, we can't defer it.
                        // We directly call resolveTurn which will edit the main game message.
                        await gameManager.resolveTurn(game, interaction.client);
                    } else {
                        // Just update the main game display.
                        await gameManager.updateDisplay(interaction.client, game, `**${interaction.user.username}** đã chọn xong!`);
                    }

                } else if (interaction.customId === 'campy_creatures_blob_absorb') {
                    const game = gameManager.getGame(interaction.channelId);
                    if (!game) return interaction.reply({ content: 'Lỗi: Không tìm thấy game.', ephemeral: true });
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player) return interaction.reply({ content: 'Lỗi: Bạn không có trong game này.', ephemeral: true });

                    if (player.playedCreature?.name !== 'The Blob' || player.absorbedCreature) {
                        return interaction.reply({ content: 'Bạn không thể thực hiện hành động này.', ephemeral: true });
                    }

                    if (player.creatureHand.length === 0) {
                        return interaction.reply({ content: 'Bạn không còn bài nào trên tay để hấp thụ!', ephemeral: true });
                    }

                    const foodButtons = player.creatureHand.map(creature =>
                        new ButtonBuilder()
                            .setCustomId(`campy_creatures_blob_select_${game.channelId}_${creature.name}`) // <- SỬA Ở ĐÂY
                            .setLabel(`Hấp thụ ${creature.name} (${creature.strength})`)
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const rows = [];
                    for (let i = 0; i < foodButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(foodButtons.slice(i, i + 5)));
                    }

                    await interaction.reply({
                        content: 'Hãy chọn một quái vật trên tay để The Blob hấp thụ sức mạnh:',
                        components: rows,
                        ephemeral: true
                    });

                } else if (interaction.customId.startsWith('campy_creatures_blob_select_')) {
                    const parts = interaction.customId.split('_');
                    const channelId = parts[4];
                    const creatureName = parts.slice(5).join('_');
                    
                    const game = gameManager.getGame(channelId);

                    if (!game) {
                        // This can happen if the bot restarts, just acknowledge it.
                        return interaction.update({ content: 'Game đã kết thúc hoặc không còn tồn tại.', components: [] });
                    }
                    
                    const player = game.players.find(p => p.id === interaction.user.id);
                    // No need to check for player, if they clicked they must be in game
                    
                    const creatureIndex = player.creatureHand.findIndex(c => c.name === creatureName);
                    const creatureToAbsorb = player.creatureHand[creatureIndex];

                    player.absorbedCreature = creatureToAbsorb;
                    player.creatureHand.splice(creatureIndex, 1);
                    game.discardPile.creatures.push(creatureToAbsorb);

                    await interaction.update({ content: `Bạn đã chọn hấp thụ **${creatureToAbsorb.name}**.`, components: [] });

                    // Pass client to resolveTurn again
                    await gameManager.resolveTurn(game, interaction.client);
                }

                if (interaction.customId === 'campy_creatures_view_discard') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player) {
                        return interaction.reply({ content: 'Bạn không có trong ván game này.', ephemeral: true });
                    }

                    let content = 'Những lá bài bạn đã đánh trong vòng này:\n';
                    if (player.creatureDiscard.length === 0) {
                        content = 'Bạn chưa đánh lá bài nào trong vòng này.';
                    } else {
                        content += player.creatureDiscard.map(c => `> - **${c.name}** (${c.strength})`).join('\n');
                    }

                    return interaction.reply({
                        content: content,
                        ephemeral: true,
                    });
                }

                if (interaction.customId === 'campy_creatures_view_captured') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player) {
                        return interaction.reply({ content: 'Bạn không có trong ván game này.', ephemeral: true });
                    }

                    const allCapturedMortals = [...(player.roundCapturedMortals || []), ...(player.persistentMortals || [])];

                    let content = 'Những lá Mortal bạn đã bắt:\n\n';
                    if (allCapturedMortals.length === 0) {
                        content = 'Bạn chưa bắt được Mortal nào.';
                    } else {
                        // Display details for each Mortal card
                        content += allCapturedMortals.map(m => {
                            let details = [];
                            if (m.points !== undefined && m.type !== 'teenager') { // Don't show points for teenagers as they are relative
                                details.push(`Điểm: ${m.points}`);
                            }
                            if (m.locationIcon > 0) {
                                details.push(`Location: ${m.locationIcon} 🏠`);
                            }
                            details.push(`Loại: ${m.type}`);

                            return `> **${m.name}**\n> *(${details.join(', ')})*`;
                        }).join('\n\n');
                    }

                    return interaction.reply({
                        content: content,
                        ephemeral: true,
                    });
                }

                if (interaction.customId === 'campy_creatures_view_creatures') {
                    let content = '# 👹 Sổ Tay Quái Vật 👹\n\n';
                    // The CREATURES array is already imported at the top of the file
                    CREATURES.forEach(creature => {
                        content += `## ${creature.strength} - ${creature.name}\n`;
                        content += `> ${creature.ability}\n\n`;
                    });

                    return interaction.reply({
                        content: content,
                        ephemeral: true,
                    });
                }

                if (interaction.customId === 'campy_creatures_capture_mortal') {
                    const currentPlayerId = game.captureOrder[game.capturingPlayerIndex];
                    if (interaction.user.id !== currentPlayerId) {
                        return interaction.reply({ content: 'Chưa đến lượt bạn bắt Mortal!', ephemeral: true });
                    }

                    const player = game.players.find(p => p.id === currentPlayerId);
                    if (!player || game.mortalsOnTable.length === 0) {
                        return interaction.reply({ content: 'Không có Mortal nào trên bàn để bắt!', ephemeral: true });
                    }

                    const mortalButtons = game.mortalsOnTable.map((mortal, index) =>
                        new ButtonBuilder()
                            .setCustomId(`campy_creatures_select_mortal_${index}`)
                            .setLabel(mortal.name)
                            .setStyle(ButtonStyle.Secondary)
                    );

                    const rows = [];
                    for (let i = 0; i < mortalButtons.length; i += 5) {
                        rows.push(new ActionRowBuilder().addComponents(mortalButtons.slice(i, i + 5)));
                    }

                    return interaction.reply({
                        content: 'Chọn một Mortal để bắt:',
                        components: rows,
                        ephemeral: true,
                    });
                }

                if (interaction.customId.startsWith('campy_creatures_select_mortal_')) {
                    const currentPlayerId = game.captureOrder[game.capturingPlayerIndex];
                    if (interaction.user.id !== currentPlayerId) {
                        return interaction.update({ content: 'Lỗi: Không phải lượt của bạn.', components: [] });
                    }
                    const player = game.players.find(p => p.id === currentPlayerId);
                    const mortalIndex = parseInt(interaction.customId.split('_').pop(), 10);
                    if (isNaN(mortalIndex) || mortalIndex >= game.mortalsOnTable.length) {
                        return interaction.update({ content: 'Lỗi: Mortal không hợp lệ.', components: [] });
                    }
                    const capturedMortal = game.mortalsOnTable.splice(mortalIndex, 1)[0];
                    player.roundCapturedMortals.push(capturedMortal);
                    await interaction.update({ content: `✅ Bạn đã bắt được **${capturedMortal.name}**!`, components: [] });
                    let messageForMainDisplay = `**${player.username}** đã bắt được **${capturedMortal.name}**.`;
                    
                    // Corrected and simpler logic
                    const isCapturePhaseOver = (game.capturingPlayerIndex + 1) >= game.players.length || game.mortalsOnTable.length === 0;
                    
                    if (isCapturePhaseOver) {
                        messageForMainDisplay += '\n\nLượt bắt đã xong!';
                        const turnResult = gameManager.startTurn(game);
                        if (turnResult.endRound) {
                            messageForMainDisplay = turnResult.log;
                        } else {
                            messageForMainDisplay += ' Bắt đầu lượt mới...';
                        }
                    } else {
                        game.capturingPlayerIndex++;
                        const nextPlayerId = game.captureOrder[game.capturingPlayerIndex];
                        const nextPlayer = game.players.find(p => p.id === nextPlayerId);
                        if (nextPlayer) {
                            messageForMainDisplay += `\n\nTiếp theo là lượt của **${nextPlayer.username}**.`;
                        }
                    }

                    await gameManager.updateDisplay(interaction.client, game, messageForMainDisplay);
                    return;
                }
                
                if (interaction.customId === 'campy_creatures_next_round') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player || !player.isHost) {
                        return interaction.reply({ content: 'Chỉ có chủ phòng mới có thể bắt đầu vòng tiếp theo.', ephemeral: true });
                    }

                    await interaction.deferUpdate();
                    // Call the new, dedicated function
                    gameManager.startNextRound(game);
                    await gameManager.updateDisplay(interaction.client, game, `Bắt đầu Vòng ${game.round}!`);
                    return;
                }

                return;
            }

            // --- Flip7 Lobby Buttons ---
            if (interaction.customId.startsWith('flip7_')) {
                if (game.gameType !== 'flip7') {
                     return interaction.reply({ content: 'Lỗi: Tương tác này dành cho game Flip7, nhưng phòng hiện tại là game khác.', ephemeral: true });
                }
            
                if (interaction.customId === 'flip7_join') {
                    if (game.gameState !== 'waiting') {
                        return interaction.reply({ content: 'Rất tiếc, ván game đã bắt đầu. Bạn không thể tham gia nữa.', ephemeral: true });
                    }
                    if (game.players.find(p => p.id === interaction.user.id)) {
                        return interaction.reply({ content: 'Bạn đã ở trong phòng chơi rồi.', ephemeral: true });
                    }
                    if (game.players.length >= 4) {
                        return interaction.reply({ content: 'Rất tiếc, phòng đã đủ 4 người chơi.', ephemeral: true });
                    }
                    const newUser = interaction.user;
                    game.players.push({ id: newUser.id, username: newUser.username, score: 0, totalScore: 0, hand: [], isHost: false });
                    await interaction.deferUpdate();
                    return updateGameDisplay(interaction, game, `**${newUser.username}** đã tham gia phòng chơi!`);
                }

                if (interaction.customId === 'flip7_leave') {
                    const playerIndex = game.players.findIndex(p => p.id === interaction.user.id);
                    if (playerIndex === -1) {
                        return interaction.reply({ content: 'Bạn không có trong phòng chơi này.', ephemeral: true });
                    }
                    const leavingUser = game.players[playerIndex];
                    game.players.splice(playerIndex, 1);
                    
                    await interaction.deferUpdate();

                    if (game.players.length === 0) {
                        gameManager.endGame(interaction.channelId);
                        
                        const endContainer = new ContainerBuilder();
                        const endText = new TextDisplayBuilder().setContent(
                            `# Phòng chơi đã giải tán\n**${leavingUser.username}** đã rời phòng, và là người cuối cùng.\n\nDùng \`/flip7 start\` để tạo phòng mới!`
                        );
                        endContainer.addTextDisplayComponents(endText);

                        return interaction.editReply({ 
                            flags: MessageFlags.IsComponentsV2,
                            components: [endContainer] 
                        });
                    }

                    if (leavingUser.isHost) {
                        game.players[0].isHost = true;
                        return updateGameDisplay(interaction, game, `**${leavingUser.username}** đã rời phòng. **${game.players[0].username}** là chủ phòng mới.`);
                    }
                    return updateGameDisplay(interaction, game, `**${leavingUser.username}** đã rời khỏi phòng chơi.`);
                }

                if (interaction.customId === 'flip7_begin') {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player || !player.isHost) {
                        return interaction.reply({ content: 'Chỉ có chủ phòng mới có thể bắt đầu ván game.', ephemeral: true });
                    }
                    if (game.gameState === 'in-progress') {
                        return interaction.reply({ content: 'Ván game đã bắt đầu rồi.', ephemeral: true });
                    }
                    if (game.players.length < 1) { // Can be changed to 2 for a real game
                        return interaction.reply({ content: 'Cần có ít nhất 1 người chơi để bắt đầu.', ephemeral: true });
                    }
                    const initialMessages = gameManager.startRound(game);
                    const gameStartMessage = 'Ván game đã bắt đầu!\n\n' + initialMessages.join('\n\n');
                    await interaction.deferUpdate();
                    return updateGameDisplay(interaction, game, gameStartMessage);

                } else if (interaction.customId.startsWith('flip7_vote_')) {
                    const player = game.players.find(p => p.id === interaction.user.id);
                    if (!player) {
                        return interaction.reply({ content: 'Bạn không có trong phòng chơi này.', ephemeral: true });
                    }

                    if (interaction.customId === 'flip7_vote_end') {
                        if (game.voteToEnd) {
                            return interaction.reply({ content: 'Đã có một cuộc bỏ phiếu đang diễn ra.', ephemeral: true });
                        }
                        game.voteToEnd = {
                            initiator: interaction.user.id,
                            votes: { [interaction.user.id]: 'yes' }, 
                            voted: [interaction.user.id]
                        };
                        const voteButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('flip7_vote_yes').setLabel('Đồng ý').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('flip7_vote_no').setLabel('Từ chối').setStyle(ButtonStyle.Danger)
                        );
                        await interaction.reply({ 
                            content: `**${interaction.user.username}** đã đề nghị kết thúc ván game! Những người chơi khác hãy bỏ phiếu.`,
                            components: [voteButtons],
                            ephemeral: false
                        });
                        return;
                    }

                    if (!game.voteToEnd) {
                        return interaction.reply({ content: 'Không có cuộc bỏ phiếu nào đang diễn ra.', ephemeral: true });
                    }
                    
                    if (game.voteToEnd.voted.includes(interaction.user.id)) {
                        return interaction.reply({ content: 'Bạn đã bỏ phiếu rồi.', ephemeral: true });
                    }

                    const vote = interaction.customId === 'flip7_vote_yes' ? 'yes' : 'no';
                    game.voteToEnd.votes[interaction.user.id] = vote;
                    game.voteToEnd.voted.push(interaction.user.id);

                    await interaction.deferUpdate();
                    await interaction.message.edit({ content: interaction.message.content + `\n**${interaction.user.username}** đã bỏ phiếu **${vote === 'yes' ? 'Đồng ý' : 'Từ chối'}**.` });

                    const totalPlayers = game.players.length;
                    const requiredVotes = Math.ceil(totalPlayers / 2);
                    const yesVotes = Object.values(game.voteToEnd.votes).filter(v => v === 'yes').length;

                    if (yesVotes >= requiredVotes) {
                        gameManager.endGame(interaction.channelId);
                        await interaction.followUp({ content: `**Đa số đã đồng ý!** Ván game đã kết thúc.`, components: []});
                         try {
                            const messages = await interaction.channel.messages.fetch({ limit: 50 });
                            const gameMessage = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
                            if (gameMessage) {
                                await gameMessage.edit({ content: 'Ván game đã kết thúc do biểu quyết.', components: [] });
                            }
                        } catch(e) { console.error("Could not edit original game message after vote.", e)}

                    } else if (game.voteToEnd.voted.length === totalPlayers) {
                         game.voteToEnd = null; // Reset vote
                        await interaction.followUp({ content: `**Không đủ phiếu!** Cuộc bỏ phiếu đã thất bại. Ván game sẽ tiếp tục.`});
                    }
                    return;
                } else if (interaction.customId === 'flip7_hit' || interaction.customId === 'flip7_stay') {

                    if (!game || game.gameState !== 'in-progress') {
                        return interaction.reply({ content: 'Ván game chưa bắt đầu hoặc đã kết thúc.', ephemeral: true });
                    }

                    const player = game.players[game.currentPlayerIndex];
                    if (player.id !== interaction.user.id) {
                        return interaction.reply({ content: 'Chưa đến lượt của bạn.', ephemeral: true });
                    }
                    
                    await interaction.deferUpdate();

                    let message = '';
                    let nextTurn = false;

                    if (interaction.customId === 'flip7_hit') {
                        const cardQueue = [];
                        
                        const initialCard = gameManager.drawCard(game);
                        if (initialCard) {
                            cardQueue.push(initialCard);
                            message = `**${player.username}** đã rút lá ${cardEmojis[initialCard.name] || `~${initialCard.name}~`}.`;
                        }

                        while (cardQueue.length > 0) {
                            if (nextTurn) break;

                            const currentCard = cardQueue.shift();
                            player.hand.push(currentCard);

                            if (currentCard.name === 'Flip Three') {
                                message += `\n🃏 **Flip Three!** Rút thêm 3 lá...`;
                                for (let i = 0; i < 3; i++) {
                                    const extraCard = gameManager.drawCard(game);
                                    if (extraCard) {
                                        cardQueue.push(extraCard);
                                        message += ` ${cardEmojis[extraCard.name] || `~${extraCard.name}~`}`;
                                    }
                                }
                            }

                            const numberCardsInHand = player.hand.filter(c => c.type === 'number');

                            if (currentCard.name === 'Freeze') {
                                message += '\n❄️ Bạn bốc phải **Freeze** và buộc phải dừng lượt!';
                                player.hasStayed = true;
                                nextTurn = true;
                                player.score = calculateRoundScore(player.hand);
                                continue;
                            }

                            const hasDuplicate = new Set(numberCardsInHand.map(c => c.value)).size !== numberCardsInHand.length;
                            if (hasDuplicate) {
                                const secondChanceIndex = player.hand.findIndex(c => c.name === 'Second Chance');
                                if (secondChanceIndex !== -1) {
                                    message += `\n✨ ... suýt nữa thì **BUST!** Nhưng lá **Second Chance** đã cứu bạn!`;
                                    player.hand.splice(secondChanceIndex, 1);
                                    const cardValues = player.hand.filter(c => c.type === 'number').map(c => c.value);
                                    const duplicateValue = cardValues.find((v, idx) => cardValues.indexOf(v) !== idx);
                                    const firstIndex = player.hand.findIndex(c => c.value === duplicateValue);
                                    if (firstIndex > -1) player.hand.splice(firstIndex, 1);
                                    const secondIndex = player.hand.findIndex(c => c.value === duplicateValue);
                                    if (secondIndex > -1) player.hand.splice(secondIndex, 1);
                                } else {
                                    message += '\n\n> ## 💀 **BUST!** 💀\n> Bạn đã bốc phải lá bài số trùng lặp.';
                                    player.isBusted = true;
                                    player.score = 0;
                                    nextTurn = true;
                                    continue;
                                }
                            }
                        }

                        if (!nextTurn) {
                            const numberCardsInHand = player.hand.filter(c => c.type === 'number');
                            if (numberCardsInHand.length >= 7) {
                                const uniqueNumberValues = new Set(numberCardsInHand.map(c => c.value));
                                if (uniqueNumberValues.size >= 7) {
                                    message += `\n\n          🎉🎉🎉🎉 **FLIP 7!** 🎉🎉🎉🎉\n**${player.username}** có 7 lá bài số khác nhau và kết thúc lượt của mình!`;
                                    player.score = calculateRoundScore(player.hand) + 15;
                                    player.hasStayed = true;
                                    nextTurn = true;
                                }
                            }
                        }
                        
                        if (!player.isBusted && !nextTurn) {
                            player.score = calculateRoundScore(player.hand);
                        }

                    } else if (interaction.customId === 'flip7_stay') {
                        player.hasStayed = true;
                        player.score = calculateRoundScore(player.hand);
                        message = `**${player.username}** đã chọn dừng lại với **${player.score}** điểm.`;
                        nextTurn = true;
                    }

                    if (nextTurn) {
                        let attempts = 0;
                        do {
                            game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
                            attempts++;
                        } while (
                            (game.players[game.currentPlayerIndex].hasStayed || game.players[game.currentPlayerIndex].isBusted) &&
                            attempts < game.players.length
                        );
                    }
                    
                    if (game.players.every(p => p.hasStayed || p.isBusted)) {
                        let roundSummary = '\n\n---\n\n### 🔄 Vòng Chơi Kết Thúc! 🔄\n';
                        let winner = null;

                        game.players.forEach(p => {
                            if (!p.isBusted) {
                                 p.totalScore += p.score;
                            }
                            roundSummary += `**${p.username}**: ${p.score} điểm (Tổng: ${p.totalScore})\n`;
                            if (p.totalScore >= 200 && (!winner || p.totalScore > winner.totalScore)) {
                                winner = p;
                            }
                        });
                        
                        if (winner) {
                            roundSummary += `\n\n# 🏆 **${winner.username.toUpperCase()} LÀ NGƯỜI CHIẾN THẮNG!** 🏆`;
                            gameManager.endGame(interaction.channelId);
                        } else {
                            const newRoundMessages = gameManager.startRound(game);
                            roundSummary += `\n\n### ✨ Bắt đầu vòng mới! ✨\n\n${newRoundMessages.join('\n\n')}`;
                        }
                        message += roundSummary;
                    }

                    await updateGameDisplay(interaction, game, message);
                    return;
                }
                }

                if (interaction.customId === 'create_profile_button') {
                    const modal = new ModalBuilder()
                        .setCustomId('profile_modal')
                        .setTitle('Tạo Profile');

                    const fullNameInput = new TextInputBuilder()
                        .setCustomId('full_name_input')
                        .setLabel('Họ và Tên')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const birthdayInput = new TextInputBuilder()
                        .setCustomId('birthday_input')
                        .setLabel('Ngày sinh (dd/mm/yyyy)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    
                    const genderInput = new TextInputBuilder()
                        .setCustomId('gender_input')
                        .setLabel('Giới tính (Nam/Nữ/Khác)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const aboutMeInput = new TextInputBuilder()
                        .setCustomId('about_me_input')
                        .setLabel('Một chút về bản thân')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false);

                    const firstActionRow = new ActionRowBuilder().addComponents(fullNameInput);
                    const secondActionRow = new ActionRowBuilder().addComponents(birthdayInput);
                    const thirdActionRow = new ActionRowBuilder().addComponents(genderInput);
                    const fourthActionRow = new ActionRowBuilder().addComponents(aboutMeInput);

                    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

                    await interaction.showModal(modal);
                }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'profile_modal') {
                const userId = interaction.user.id;
                const fullName = interaction.fields.getTextInputValue('full_name_input');
                const birthday = interaction.fields.getTextInputValue('birthday_input');
                const gender = interaction.fields.getTextInputValue('gender_input');
                const aboutMe = interaction.fields.getTextInputValue('about_me_input');

                const db = interaction.client.db;
                const stmt = db.prepare(`
                    INSERT INTO users (user_id, full_name, birthday, gender, about_me)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        full_name = excluded.full_name,
                        birthday = excluded.birthday,
                        gender = excluded.gender,
                        about_me = excluded.about_me
                `);
                stmt.run(userId, fullName, birthday, gender, aboutMe);

                await interaction.reply({ content: 'Thông tin profile của bạn đã được cập nhật!', ephemeral: true });
            }
        }
    },
}; 