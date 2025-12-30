module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    notifyChannelId: process.env.CHANNEL_ID,
    notifyRoleIds: [process.env.ROLE_1, process.env.ROLE_2],
    targetUserId: process.env.TARGET_USER_ID,
    penaltyKeywords: ['cô ấy', 'bạn ấy', 'co ay', 'ban ay', 'co a', 'ban a', 'Pio', 'người ấy', 'nguoi ay', 'bạn đấy', 'bạn đó'],
}; 