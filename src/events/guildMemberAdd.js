const { Events } = require('discord.js');
const { guildId, notifyChannelId, notifyRoleIds } = require('../../config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        if (member.guild.id !== guildId) return;

        const channel = await member.client.channels.fetch(notifyChannelId);
        if (!channel) return console.error('Notify channel not found');

        const mentions = notifyRoleIds.map(id => `<@&${id}>`).join(' ');
        const message = `🎉🎉🎉🎉 Các ${mentions}  đón thành viên mới ${member.user.username} đi nào, không thì bị chích điện! 🎉🎉🎉🎉`;

        await channel.send(message);
    },
}; 