const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ActionRowBuilder, SectionBuilder, SeparatorBuilder, ThumbnailBuilder, MediaGalleryBuilder } = require('discord.js');
const gameManager = require('../../game/GameManager');
const cardEmojis = require('../../game/cardEmojis');

async function updateGameDisplay(interaction, game, content) {
    const container = new ContainerBuilder().setAccentColor(0xFF0000);

    const bannerr = new MediaGalleryBuilder().addItems([{
        media: { url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGR4eTN1cWt1N3g2ZGxnZXVtdDBrY2h1ZTRhZDdsY2EwNHJocXkzZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHF6VkFM4uKeRDa/giphy.gif' }
    }]);
    container.addMediaGalleryComponents(bannerr);

    container.addSeparatorComponents(new SeparatorBuilder());

    const Logs = new TextDisplayBuilder().setContent('# <:GhostsHutao:1395099444311101652> Lịch sử hành động <:GhostsHutao:1395099444311101652>');
    container.addTextDisplayComponents(Logs);

    if (content) {
        const contentText = new TextDisplayBuilder().setContent(content);
        container.addTextDisplayComponents(contentText);
        container.addSeparatorComponents(new SeparatorBuilder());
    }

    const title = new TextDisplayBuilder().setContent('# 🃏 Bàn Chơi Flip 7 🃏');
    container.addTextDisplayComponents(title);
    container.addSeparatorComponents(new SeparatorBuilder());

    for (const player of game.players) {
        const emojiString = player.hand.length > 0
            ? player.hand.map(c => cardEmojis[c.name] || `~${c.name}~`).join(' ')
            : 'Chưa có bài';
        
        const handString = player.hand.length > 0 ? `# ${emojiString}` : emojiString;

        const playerInfoText = new TextDisplayBuilder()
            .setContent(`**${player.username}** (Tổng điểm: ${player.totalScore})\n**Bài trên tay:**\n${handString}\n\n**Điểm vòng:** ${player.score}`);
        
        const playerSection = new SectionBuilder().addTextDisplayComponents(playerInfoText);
        
        try {
            const user = await interaction.client.users.fetch(player.id);
            const avatarURL = user.displayAvatarURL({ dynamic: true, size: 128 });
            const thumbnail = new ThumbnailBuilder({ media: { url: avatarURL } });
            playerSection.setThumbnailAccessory(thumbnail);
        } catch (error) {
            console.error(`Could not fetch user ${player.id} for thumbnail:`, error);
        }

        container.addSectionComponents(playerSection);
        container.addSeparatorComponents(new SeparatorBuilder());
    }

    const currentPlayer = game.players[game.currentPlayerIndex];
    let statusMessage = `Trạng thái: **${game.gameState}**`;
    if (game.gameState === 'in-progress' && currentPlayer) {
        statusMessage += `\n\n> **Lượt của ${currentPlayer.username}** <`;
    } else if (game.gameState === 'waiting') {
        statusMessage += `\nĐang chờ người chơi... (${game.players.length}/4)`;
    }
    const gameStatus = new TextDisplayBuilder().setContent(statusMessage);
    container.addTextDisplayComponents(gameStatus);

    const lobbyButtons = new ActionRowBuilder();
    if (game.gameState === 'waiting') {
        lobbyButtons.addComponents(
            new ButtonBuilder().setCustomId('flip7_join').setLabel('Tham gia').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('flip7_leave').setLabel('Rời phòng').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('flip7_begin').setLabel('Bắt đầu').setStyle(ButtonStyle.Primary)
        );
    }
    
    const gameButtons = new ActionRowBuilder();
    if (game.gameState === 'in-progress') {
        gameButtons.addComponents(
            new ButtonBuilder().setCustomId('flip7_hit').setLabel('Rút bài (Hit)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('flip7_stay').setLabel('Dừng (Stay)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('flip7_vote_end').setLabel('Vote Kết Thúc').setStyle(ButtonStyle.Danger)
        );
    }
    
    const components = [container];
    if (lobbyButtons.components.length > 0) {
        components.push(lobbyButtons);
    }
    if (gameButtons.components.length > 0) {
        components.push(gameButtons);
    }
    
    const replyOptions = {
        flags: MessageFlags.IsComponentsV2,
        components: components
    };
    
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(replyOptions);
    } else {
        await interaction.reply(replyOptions);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip7')
        .setDescription('Chơi game Flip 7!')
        .addSubcommand(subcommand => subcommand.setName('start').setDescription('Bắt đầu một phòng chơi Flip 7 mới.')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const channelId = interaction.channelId;

        if (subcommand === 'start') {
            const { game: newGame, error } = gameManager.createGame(channelId, 'flip7');
            if (error) {
                return interaction.reply({ content: error, ephemeral: true });
            }
            const host = interaction.user;
            newGame.players.push({ id: host.id, username: host.username, score: 0, totalScore: 0, hand: [], isHost: true });
            return updateGameDisplay(interaction, newGame, `Phòng chơi đã được tạo bởi **${host.username}**! Sử dụng các nút bên dưới để tương tác.`);
        }
    },
    updateGameDisplay
};