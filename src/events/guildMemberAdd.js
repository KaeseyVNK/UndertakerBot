const { Events } = require('discord.js');
const { guildId, notifyChannelId } = require('../../config.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        if (member.guild.id !== guildId) return;

        const channel = await member.client.channels.fetch(notifyChannelId);
        if (!channel) return console.error('Notify channel not found');

        const message = `Thay mặt <@755328143023144971> chào mừng bạn ${member.toString()} đến với server và có khoảng thời gian vui vẻ`;

        await channel.send(message);
    },
}; 