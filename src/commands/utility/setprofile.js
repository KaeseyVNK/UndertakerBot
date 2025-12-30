const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setprofile')
        .setDescription('Đặt thông tin profile của bạn.')
        .addStringOption(option =>
            option.setName('full_name')
                .setDescription('Họ và Tên')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('birthday')
                .setDescription('Ngày sinh (dd/mm/yyyy)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('gender')
                .setDescription('Giới tính')
                .setRequired(false)
                .addChoices(
                    { name: 'Nam', value: 'Nam' },
                    { name: 'Nữ', value: 'Nữ' },
                    { name: 'Khác', value: 'Khác' }
                ))
        .addStringOption(option =>
            option.setName('about_me')
                .setDescription('Một chút về bản thân bạn.')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('thumbnail')
                .setDescription('Ảnh thumbnail tùy chỉnh của bạn.')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('banner')
                .setDescription('Ảnh banner tùy chỉnh của bạn.')
                .setRequired(false)),
    async execute(interaction) {
        const userId = interaction.user.id;
        const fullName = interaction.options.getString('full_name');
        const birthday = interaction.options.getString('birthday');
        const gender = interaction.options.getString('gender');
        const aboutMe = interaction.options.getString('about_me');
        const thumbnail = interaction.options.getAttachment('thumbnail');
        const banner = interaction.options.getAttachment('banner');

        if (!fullName && !birthday && !gender && !aboutMe && !thumbnail && !banner) {
            return interaction.reply({ content: 'Vui lòng cung cấp ít nhất một thông tin để cập nhật.', ephemeral: true });
        }

        const thumbnailUrl = thumbnail ? thumbnail.url : null;
        const bannerUrl = banner ? banner.url : null;

        const db = interaction.client.db;
        const stmt = db.prepare(`
            INSERT INTO users (user_id, full_name, birthday, gender, about_me, thumbnail_url, banner_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                full_name = COALESCE(?, full_name),
                birthday = COALESCE(?, birthday),
                gender = COALESCE(?, gender),
                about_me = COALESCE(?, about_me),
                thumbnail_url = COALESCE(?, thumbnail_url),
                banner_url = COALESCE(?, banner_url)
        `);
        stmt.run(userId, fullName, birthday, gender, aboutMe, thumbnailUrl, bannerUrl, fullName, birthday, gender, aboutMe, thumbnailUrl, bannerUrl);

        await interaction.reply({ content: 'Thông tin profile của bạn đã được cập nhật!', ephemeral: true });
    },
}; 