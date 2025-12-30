const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ActionRowBuilder, SectionBuilder, SeparatorBuilder, ThumbnailBuilder } = require('discord.js');
const gameManager = require('../../game/GameManager');

async function buildGameDisplay(client, game, content) {
    const container = new ContainerBuilder();
    let components = [];

    if (game.gameState === 'waiting') {
        container.setAccentColor(0x5865F2);
        if (content) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${content}`));
            container.addSeparatorComponents(new SeparatorBuilder());
        }
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🏕️ Phòng Chờ Campy Creatures 👹'));
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## Nhà Khoa Học Điên Hiện Có:'));
        if (game.players.length === 0) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('Chưa có ai tham gia...'));
        } else {
            for (const player of game.players) {
                const playerSection = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`- **${player.username}** ${player.isHost ? '(Chủ phòng)' : ''}`));
                try {
                    const user = await client.users.fetch(player.id);
                    playerSection.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.displayAvatarURL({ dynamic: true, size: 128 }) } }));
                } catch (error) { console.error(`Could not fetch user ${player.id} for thumbnail:`, error); }
                container.addSectionComponents(playerSection);
            }
        }
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Trạng thái:** ${game.gameState}\n*Đang chờ người chơi... (${game.players.length}/5)*`));
        const lobbyButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('campy_creatures_join').setLabel('Tham gia').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('campy_creatures_leave').setLabel('Rời phòng').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('campy_creatures_begin').setLabel('Bắt đầu').setStyle(ButtonStyle.Primary)
        );
        components = [container, lobbyButtons];
    } else if (game.gameState === 'in-progress') {
        container.setAccentColor(0x2ECC71);
        if (content) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> ${content}`));
            container.addSeparatorComponents(new SeparatorBuilder());
        }
        const titleText = `# 👹 Ván Đấu - Vòng ${game.round} - Lượt ${game.turnNumber} 👹`;
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(titleText));
        container.addSeparatorComponents(new SeparatorBuilder());

        if (game.activeLocation) {
            // Remove the card count from the Location display
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📍 Location: **${game.activeLocation.name}**`));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`> *${game.activeLocation.description}*`));
            container.addSeparatorComponents(new SeparatorBuilder());
        }

        // Display Clash-O-Meter
        const meterTitle = new TextDisplayBuilder().setContent('## 💥 Clash-O-Meter 💥');
        const meterOrder = game.clashOMeter.map((playerId, index) => {
            const player = game.players.find(p => p.id === playerId);
            const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || `**${index + 1}.**`;
            return `${medal} ${player?.username || 'Không rõ'}`;
        }).join('\n');
        container.addTextDisplayComponents(meterTitle);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(meterOrder));
        container.addSeparatorComponents(new SeparatorBuilder());

        // Player Info
        const currentPlayerId = game.captureOrder[game.capturingPlayerIndex];
        const currentPlayer = game.players.find(p => p.id === currentPlayerId);
        if (currentPlayer) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎯 Lượt bắt của: **${currentPlayer.username}**`));
        }
        const mortalsTitleText = `## 🏃‍♂️ Dân Làng Để Bắt (Còn lại: ${game.mortalDeck.length} lá)`;
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(mortalsTitleText));
        
        const mortalsOnTable = game.mortalsOnTable?.map(m => {
            let details = [];
            if (m.type !== 'teenager') {
                details.push(`Điểm: ${m.points}`);
            }
            if (m.locationIcon > 0) {
                details.push(`Location: ${m.locationIcon} 🏠`);
            }
            details.push(`Loại: ${m.type}`);
            
            return `> - **${m.name}** (${details.join(', ')})`;
        }).join('\n') || '> Bàn trống!';

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(mortalsOnTable));
        container.addSeparatorComponents(new SeparatorBuilder());
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 👨‍🔬 Các Nhà Khoa Học:'));
        for (const [index, player] of game.players.entries()) { // Sử dụng .entries() để lấy cả index
            const capturedMortals = player.roundCapturedMortals.map(m => m.name).join(', ') || 'Chưa có';
            const conqueredLocations = player.conqueredLocations.map(l => l.name).join(', ') || 'Chưa có';
            let playedCreatureName = '(Đang chọn...)';
            if (player.playedCreature) {
                const showCreature = game.turnPhase === 'capturing' || game.turnPhase === 'waiting_for_blob';
                if (showCreature) {
                    let creatureDisplay = '';
                    if (player.playedCreature.name === 'The Blob') {
                        if (player.abilityDisabled) {
                            creatureDisplay = `Đã chơi: **The Blob** (Kỹ năng bị vô hiệu hóa, Sức mạnh cuối: 0)`;
                        } else if (player.absorbedCreature) {
                            creatureDisplay = `Đã chơi: **The Blob**, hấp thụ **${player.absorbedCreature.name}** (Sức mạnh cuối: ${player.finalStrength})`;
                        } else {
                            creatureDisplay = `Đã chơi: **The Blob** (Chờ chọn thức ăn...)`;
                        }
                    } else {
                        // For non-blob players
                        creatureDisplay = `Đã chơi: **${player.playedCreature.name}** (Sức mạnh cuối: ${player.finalStrength})`;
                    }
                    playedCreatureName = `(${creatureDisplay})`;
                } else {
                    playedCreatureName = '(Đã chọn ✓)';
                }
            }
            // Thêm số thứ tự vào đầu
            const playerInfo = `**${index + 1}. ${player.username}** ${playedCreatureName}\n- *Điểm:* ${player.totalScore} | *Locations:* ${conqueredLocations}\n- *Bắt được (vòng này):* ${capturedMortals}`;
            const playerSection = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(playerInfo));
            try {
                const user = await client.users.fetch(player.id);
                playerSection.setThumbnailAccessory(new ThumbnailBuilder({ media: { url: user.displayAvatarURL({ dynamic: true, size: 128 }) } }));
            } catch (error) { console.error(`Could not fetch user ${player.id} for thumbnail:`, error); }
            container.addSectionComponents(playerSection);
        }
        const gameButtons = new ActionRowBuilder();
        if (game.turnPhase === 'capturing') {
            gameButtons.addComponents(new ButtonBuilder().setCustomId('campy_creatures_capture_mortal').setLabel('Bắt Mortal').setStyle(ButtonStyle.Success).setEmoji('🏃‍♂️'));
        } else if (game.turnPhase === 'swamp_creature_give') {
            gameButtons.addComponents(new ButtonBuilder().setCustomId('campy_creatures_swamp_creature_give').setLabel('Tặng Mortal').setStyle(ButtonStyle.Primary).setEmoji('🎁'));
        } else if (game.turnPhase === 'werewolf_discard') {
             gameButtons.addComponents(new ButtonBuilder().setCustomId('campy_creatures_werewolf_discard').setLabel('Loại Bỏ Bài').setStyle(ButtonStyle.Danger).setEmoji('🐺'));
        } else if (game.turnPhase === 'waiting_for_blob') {
            // New button for Blob players
            gameButtons.addComponents(new ButtonBuilder().setCustomId('campy_creatures_blob_absorb').setLabel('Blob: Chọn Thức Ăn').setStyle(ButtonStyle.Danger).setEmoji('☣️'));
        } else { // 'choosing' phase
            gameButtons.addComponents(new ButtonBuilder().setCustomId('campy_creatures_show_hand').setLabel('Chọn Quái Vật').setStyle(ButtonStyle.Primary).setEmoji('👹'));
        }
        gameButtons.addComponents(
            new ButtonBuilder().setCustomId('campy_creatures_view_discard').setLabel('Xem Bài Đã Đánh').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('campy_creatures_view_captured').setLabel('Xem Mortals Đã Bắt').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('campy_creatures_view_creatures').setLabel('Xem Bài Quái Vật').setStyle(ButtonStyle.Secondary).setEmoji('📖')
        );
        components = [container, gameButtons];
    } else if (game.gameState === 'end_of_round' || game.gameState === 'finished') {
        // New display for end of round/game summary
        container.setAccentColor(0xF1C40F); // Yellow for summary
        if (content) {
            // The 'content' will be the full round summary log
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
        }

        const actionRow = new ActionRowBuilder();
        
        if (game.gameState === 'end_of_round') {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('campy_creatures_next_round')
                    .setLabel(`Bắt Đầu Vòng ${game.round + 1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('▶️')
            );
        }

        // Add info buttons for both 'end_of_round' and 'finished' states
        actionRow.addComponents(
            new ButtonBuilder().setCustomId('campy_creatures_view_discard').setLabel('Xem Bài Đã Đánh').setStyle(ButtonStyle.Secondary).setEmoji('🗑️'),
            new ButtonBuilder().setCustomId('campy_creatures_view_captured').setLabel('Xem Mortals Đã Bắt').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
            new ButtonBuilder().setCustomId('campy_creatures_view_creatures').setLabel('Xem Bài Quái Vật').setStyle(ButtonStyle.Secondary).setEmoji('📖')
        );
        
        // Only add the row if it has buttons
        if (actionRow.components.length > 0) {
            components = [container, actionRow];
        } else {
            components = [container];
        }
    }
    
    return {
        content: '',
        flags: MessageFlags.IsComponentsV2,
        components: components,
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('campy-creatures')
        .setDescription('Chơi board game Campy Creatures!')
        .addSubcommand(subcommand => subcommand.setName('start').setDescription('Tạo một phòng chơi Campy Creatures mới.')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channelId = interaction.channelId;

        if (subcommand === 'start') {
            const { game: newGame, error } = gameManager.createGame(channelId, 'campy-creatures');
            if (error) {
                return interaction.reply({ content: error, ephemeral: true });
            }
            const host = interaction.user;
            newGame.players.push({ id: host.id, username: host.username, isHost: true });
            
            const replyOptions = await buildGameDisplay(interaction.client, newGame, `Phòng chơi được tạo bởi **${host.username}**!`);
            await interaction.reply(replyOptions);
            const message = await interaction.fetchReply();
            if (message) {
                newGame.messageId = message.id;
            }
        }
    },
    buildGameDisplay
}; 