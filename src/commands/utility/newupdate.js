const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    TextDisplayBuilder, 
    MessageFlags, 
    SeparatorBuilder, 
    SeparatorSpacingSize, 
    SectionBuilder, 
    ThumbnailBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MediaGalleryBuilder,
    ContainerBuilder,
    AttachmentBuilder,
    FileBuilder

} = require('discord.js');

const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Profile')
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Người dùng bạn muốn xem profile')),
    async execute(interaction, client) {
        // Cố gắng lấy guild từ interaction hoặc fetch nếu chưa có
        let guild = interaction.guild;
        if (!guild && interaction.guildId) {
            try {
                guild = await interaction.client.guilds.fetch(interaction.guildId);
            } catch (error) {
                // Chỉ log nếu lỗi KHÁC lỗi Unknown Guild (10004) để tránh spam log khi dùng trong DM
                if (error.code !== 10004) {
                    console.error('Error fetching guild:', error);
                }
            }
        }

        if (!guild) {
             // Fallback cho trường hợp DM hoặc lỗi fetch
             return interaction.reply({ content: 'Lệnh này cần được thực hiện trong Server để hiển thị đầy đủ thông tin.', ephemeral: true });
        }

        const user = interaction.options.getUser('target') || interaction.user;
        
        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (error) {
            return interaction.reply({ content: 'Không tìm thấy thành viên này trong server.', ephemeral: true });
        }

        const fullUser = await user.fetch({ force: true });

        // Lấy thông tin từ database
        const db = interaction.client.db;
        const row = db.prepare('SELECT full_name, birthday, gender, about_me, thumbnail_url, banner_url FROM users WHERE user_id = ?').get(user.id);

        const fullName = row?.full_name || 'Chưa đặt';
        const birthday = row?.birthday || 'Chưa đặt';
        const gender = row?.gender || 'Chưa đặt';
        const aboutMe = row?.about_me || 'Chưa có mô tả.';
        const customThumbnailUrl = row?.thumbnail_url;
        const customBannerUrl = row?.banner_url;

        // Lấy vai trò
        const rolesString = member.roles.cache.size > 1
            ? member.roles.cache.filter(r => r.id !== guild.id).map(r => r.toString()).join(' ')
            : 'Không có vai trò nào.';

        const container = new ContainerBuilder().setAccentColor(0xFF0000);

        
        // Logic banner động: DB -> Banner Discord -> Bỏ qua nếu không có
        const bannerUrl = customBannerUrl || fullUser.bannerURL({ dynamic: true, size: 512 });
        if (bannerUrl) {
            const media = new MediaGalleryBuilder()
                .addItems([{
                    media: { url: bannerUrl }
                }]);
            container.addMediaGalleryComponents(media);
        }

        const EmojiHoVaTen = '<:GhostsHutao:1395099444311101652>';
        const EmojiNgaySinh = '<:HutaoCake:1395106704928280626>';
        const EmojiGioiTinh = '<:GenderHutao:1395817240242294794>';
        const EmojiAboutMe = '<:HomaStaff:1395825516153671741>';
        const EmojiThoiGian = '<:ClockHutao:1395430908315570259>';
        const EmojiVaiTro = '<:GenderHutao:1395817240242294794>';

        const TextToDisplay = new TextDisplayBuilder()
            .setContent(`# ${EmojiHoVaTen} THÔNG TIN HỒ SƠ\n\n- **Họ và Tên:** ${fullName}\n- **Ngày sinh:** ${birthday}\n- **Giới tính:** ${gender}\n`);

        // Sử dụng thumbnail từ DB hoặc avatar mặc định
        const thumbnailUrl = customThumbnailUrl || user.displayAvatarURL({ dynamic: true, size: 128 });
        const thumnail = new ThumbnailBuilder({
            media: {
                url: thumbnailUrl,
            }
        })

        const sectionInfo = new SectionBuilder()
            .addTextDisplayComponents(TextToDisplay)
            .setThumbnailAccessory(thumnail);

        container.addSectionComponents(sectionInfo);

         const separatorInfo = new SeparatorBuilder()
         container.addSeparatorComponents(separatorInfo);

         const titleAboutMe = '## ' + EmojiAboutMe + ' Về Bản Thân Tôi';
         const textAboutMe = new TextDisplayBuilder().setContent(titleAboutMe + '\n' +'> ' + aboutMe + '\n\n' + ' ');

         
         container.addTextDisplayComponents(textAboutMe);

         const separatorAboutMe = new SeparatorBuilder()
         container.addSeparatorComponents(separatorAboutMe);

         // Thêm mục hiển thị vai trò
         const titleRoles = '## ' + EmojiVaiTro + ' Vai trò';
         const textRoles = new TextDisplayBuilder().setContent(titleRoles + '\n' + rolesString + '\n');
         container.addTextDisplayComponents(textRoles);

         const separatorRoles = new SeparatorBuilder();
         container.addSeparatorComponents(separatorRoles);

         // Thêm mục hiển thị thời gian
         const joinedDate = member.joinedAt;
         const now = new Date();
         const daysSinceJoined = Math.floor((now.getTime() - joinedDate.getTime()) / (1000 * 60 * 60 * 24));
         const joinDateString = joinedDate.toLocaleDateString('vi-VN');

         const titleTime = '## ' + EmojiThoiGian + ' Thời gian';
         const contentTime = `Tham gia máy chủ: ${joinDateString} - ${daysSinceJoined} ngày trước\n`;
         const textTime = new TextDisplayBuilder().setContent(`${titleTime}\n${contentTime}`);
         container.addTextDisplayComponents(textTime);
         
         const separatorTime = new SeparatorBuilder();
         container.addSeparatorComponents(separatorTime);




        // const sectionAboutMe = new SectionBuilder()
        // .addTextDisplayComponents(TextToDisplay2)
        // .addTextDisplayComponents(contentAboutMe)

        // container.addSectionComponents(sectionAboutMe);


        // const sectionAboutMe = new SectionBuilder()
        // .addTextDisplayComponents(TextToDisplay2. ẽ)

        // container.addSectionComponents(sectionAboutMe);


        //------------------------------------------------------------------------


        // const text1 = new TextDisplayBuilder().setContent('Link Hinh Anh 1');
        // const button = new ButtonBuilder().setLabel('Link Hinh Anh 1').setStyle(ButtonStyle.Link).setURL('https://i.pinimg.com/736x/57/1c/8e/571c8e64f0ee3d2a2f66e6a433c9c4fc.jpg');

        // const section1 = new SectionBuilder()
        //     .addTextDisplayComponents(text1)
        //     .setButtonAccessory(button);

        // container.addSectionComponents(section1);

        // const text2 = new TextDisplayBuilder().setContent('Link Hinh Anh 2');
        // const button2 = new ButtonBuilder().setLabel('Link Hinh Anh 2').setStyle(ButtonStyle.Link).setURL('https://i.pinimg.com/736x/57/1c/8e/571c8e64f0ee3d2a2f66e6a433c9c4fc.jpg');
        
        // const section2 = new SectionBuilder()
        //     .addTextDisplayComponents(text2)
        //     .setButtonAccessory(button2);

        // container.addSectionComponents(section2);
        
        // const text3 = new TextDisplayBuilder().setContent('Link Hinh Anh 3');
        // const button3 = new ButtonBuilder().setLabel('Link Hinh Anh 3').setStyle(ButtonStyle.Link).setURL('https://i.pinimg.com/736x/57/1c/8e/571c8e64f0ee3d2a2f66e6a433c9c4fc.jpg');
        
        // const section3 = new SectionBuilder()
        //     .addTextDisplayComponents(text3)
        //     .setButtonAccessory(button3);

        // container.addSectionComponents(section3);

        const separator1 = new SeparatorBuilder()

        container.addSeparatorComponents(separator1);

        const text4 = new TextDisplayBuilder().setContent('Thông tin hồ sơ của: ' + user.username);

        container.addTextDisplayComponents(text4);




        //------------------------------------------------------------------------------------------------



        // const filePath = path.join(__dirname, '../../../package.json');
        // const fileContent = await fs.promises.readFile(filePath, 'utf8');

        // const attachment = new AttachmentBuilder(Buffer.from(fileContent), {
        //     name: 'package.json'
        // });

        // const file = new FileBuilder().setURL('attachment://package.json');

        // container.addFileComponents(file);

        interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [container],
            // files: [attachment]
        });
    }
};