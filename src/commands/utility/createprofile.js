const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createprofile')
        .setDescription('Tạo profile của bạn bằng cách sử dụng components.'),
    async execute(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_profile_button')
                    .setLabel('Bắt đầu tạo Profile')
                    .setStyle(ButtonStyle.Primary),
            );

        await interaction.reply({
            content: 'Nhấn nút bên dưới để bắt đầu tạo hoặc cập nhật profile của bạn.',
            components: [row],
            ephemeral: true,
        });
    },
}; 