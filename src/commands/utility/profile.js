const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('node:path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profileold')
		.setDescription('Hiển thị thông tin profile của người dùng.')
		.addUserOption(option =>
			option.setName('target')
				.setDescription('Người dùng bạn muốn xem profile')),
	async execute(interaction) {
		// If no user is specified, it defaults to the user who ran the command.
		const user = interaction.options.getUser('target') || interaction.user;
		const member = await interaction.guild.members.fetch(user.id);

		// Get user's activities
		const activities = member.presence?.activities || [];
		const activityString = activities.map(activity => {
			let line = `**${activity.name}**`;
			if (activity.details) line += `\n*${activity.details}*`;
			if (activity.state) line += `\n*${activity.state}*`;
			return line;
		}).join('\n\n') || 'Không có hoạt động nào.';

		// Combine user info into one string for the left column
        const db = interaction.client.db;
        const row = db.prepare('SELECT full_name, birthday, gender, about_me, thumbnail_url, banner_url FROM users WHERE user_id = ?').get(user.id);

        const fullName = row?.full_name || 'Chưa đặt';
        const birthday = row?.birthday || 'Chưa đặt';
        const gender = row?.gender || 'Chưa đặt';
        const aboutMe = row?.about_me || 'Chưa có mô tả.';
		const customThumbnail = row?.thumbnail_url;
		const customBanner = row?.banner_url;

		// Get user roles, excluding @everyone
		const rolesString = member.roles.cache.size > 1
			? member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r).join(' ')
			: 'Không có vai trò nào.';

		// Fetch user to get banner information
		const fullUser = await user.fetch({ force: true });

		const embed = new EmbedBuilder()
			.setColor(255,0,0)
			.setAuthor({ name: `Thông tin cá nhân của: ${user.username}`})
			.setThumbnail(customThumbnail || user.displayAvatarURL({ dynamic: true }))
			.addFields(
				{ name: ' <:GhostsHutao:1395099444311101652> Họ và Tên', value: fullName, inline: true },
                { name: ' <:HutaoCake:1395106704928280626> Ngày sinh', value: birthday, inline: true },
                { name: ' <:GenderHutao:1395817240242294794> Giới tính', value: `${gender}\n`, inline: false },
				{ name: ' 📝 Về tôi', value: `${aboutMe}\n`, inline: false},
                { name: ' <:ClockHutao:1395430908315570259> Thời gian', value: `Tạo: ${new Date(user.createdAt).toLocaleDateString('vi-VN')} | Tham gia: ${new Date(member.joinedAt).toLocaleDateString('vi-VN')}`, inline: false },
                { name: ' <:EmojiHutao:1395826066546888857> Vai trò', value: rolesString, inline: false }
				//{ name: ' <:HomaStaff:1395825516153671741> Hoạt động', value: "```ini\n" + `${activityString}` + "\n```", inline: false }
			)
			.setTimestamp()
			.setFooter({ text: `Yêu cầu bởi ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) });

		// Use custom banner if available, otherwise fall back to Discord's banner or avatar
		if (customBanner) {
			embed.setImage(customBanner);
		} else if (fullUser.banner) {
			embed.setImage(fullUser.bannerURL({ dynamic: true, size: 512 }));
		} else {
			embed.setImage(user.displayAvatarURL({ dynamic: true, size: 512 }));
		}

		await interaction.reply({ embeds: [embed] });
	},
}; 


