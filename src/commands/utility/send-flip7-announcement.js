const { 
    SlashCommandBuilder, 
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send-flip7-announcement')
        .setDescription('Gửi thông báo về game Flip 7 đến một kênh cụ thể.'),
    async execute(interaction) {
        // ID của kênh bạn muốn gửi thông báo
        const channelId = '1390695244198318220'; 
        
        // Kiểm tra xem người dùng có quyền admin không (ví dụ)
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({ content: 'Bạn không có quyền sử dụng lệnh này.', ephemeral: true });
        }

        const targetChannel = await interaction.client.channels.cache.get(channelId);
        if (!targetChannel) {
            return interaction.reply({ content: 'Không tìm thấy kênh được chỉ định.', ephemeral: true });
        }

        const container = new ContainerBuilder().setAccentColor(0xFF0000);

        // Banner
        const banner = new MediaGalleryBuilder().addItems([{
            media: { url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGR4eTN1cWt1N3g2ZGxnZXVtdDBrY2h1ZTRhZDdsY2EwNHJocXkzZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHF6VkFM4uKeRDa/giphy.gif' }
        }]);
        container.addMediaGalleryComponents(banner);
        container.addSeparatorComponents(new SeparatorBuilder());

        // Tiêu đề chính - Thêm @everyone vào đây
        const mainTitle = new TextDisplayBuilder().setContent('@everyone\n\n# 📢 THÔNG BÁO: MỜI THỬ NGHIỆM BOARD GAME MỚI - FLIP 7! 🃏');
        container.addTextDisplayComponents(mainTitle);

        const introText = new TextDisplayBuilder().setContent(
            "Chào cả nhà,\n\n" +
            "Bot của server chúng ta vừa được cập nhật một board game mới cực kỳ độc đáo mang tên **Flip 7**! Đây là một trò chơi chiến thuật, tính điểm và đầy may rủi, hứa hẹn sẽ mang lại những giây phút giải trí căng thẳng nhưng cũng rất vui vẻ.\n\n" +
            "Game đang trong giai đoạn thử nghiệm, vì vậy rất mong mọi người cùng tham gia, \"phá game\" và cho mình xin những ý kiến quý báu để hoàn thiện sản phẩm nhé!"
        );
        container.addTextDisplayComponents(introText);
        container.addSeparatorComponents(new SeparatorBuilder());

        // Luật chơi
        const rulesTitle = new TextDisplayBuilder().setContent('## 📜 LUẬT CHƠI FLIP 7');
        const rulesText = new TextDisplayBuilder().setContent(
            "**Mục tiêu cuối cùng:** Trở thành người chơi đầu tiên đạt **200 điểm** tổng sau nhiều vòng đấu.\n\n" +
            "**Trong mỗi vòng chơi, mục tiêu của bạn là:**\n" +
            "1. **Tránh bị BUST:** Bạn sẽ bị **BUST** (thua ngay vòng đó và 0 điểm) nếu rút phải một lá bài **số** mà bạn đã có trên tay.\n" +
            "2. **Đạt điểm cao nhất:** Vào cuối vòng, điểm sẽ được tính dựa trên các lá bài bạn có."
        );
        container.addTextDisplayComponents(rulesTitle);
        container.addTextDisplayComponents(rulesText);
        container.addSeparatorComponents(new SeparatorBuilder());

        // Cách tính điểm
        const scoringTitle = new TextDisplayBuilder().setContent('### ✨ CÁCH TÍNH ĐIỂM');
        const scoringText = new TextDisplayBuilder().setContent(
            "- **Lá bài số (0-12):** Cộng tất cả giá trị của các lá bài số.\n" +
            "- **Lá bài Modifier (+2, +4, ...):** Cộng thêm giá trị vào tổng điểm.\n" +
            "- **Lá bài Modifier (x2):** Nhân đôi tổng điểm."
        );
        const flip7Title = new TextDisplayBuilder().setContent('### 🏆 **FLIP 7 - CÚ ĂN MAY TUYỆT ĐỐI!**');
        const flip7Text = new TextDisplayBuilder().setContent(
            "Nếu bạn thu thập được **7 lá bài số khác nhau**, bạn sẽ đạt được **\"FLIP 7\"**!\n" +
            "**Phần thưởng:** Điểm vòng đó sẽ là điểm tính theo các lá bài **cộng thêm 15 điểm bonus**!"
        );
        container.addTextDisplayComponents(scoringTitle);
        container.addTextDisplayComponents(scoringText);
        container.addTextDisplayComponents(flip7Title);
        container.addTextDisplayComponents(flip7Text);
        container.addSeparatorComponents(new SeparatorBuilder());

        // Lá bài hành động
        const actionCardsTitle = new TextDisplayBuilder().setContent('### 🃏 CÁC LÁ BÀI HÀNH ĐỘNG (ACTION CARDS)');
        const actionCardsText = new TextDisplayBuilder().setContent(
            "- `Flip Three`: Bắt buộc rút thêm 3 lá bài nữa.\n" +
            "- `Freeze`: Mất lượt và buộc phải \"Dừng\".\n" +
            "- `Second Chance`: Cứu bạn khỏi BUST bằng cách hủy chính nó và cặp bài trùng lặp."
        );
        container.addTextDisplayComponents(actionCardsTitle);
        container.addTextDisplayComponents(actionCardsText);
        container.addSeparatorComponents(new SeparatorBuilder());

        // Hướng dẫn chơi
        const howToPlayTitle = new TextDisplayBuilder().setContent('## 🎮 HƯỚNG DẪN CÁCH CHƠI');
        const howToPlayText = new TextDisplayBuilder().setContent(
            "Sử dụng các lệnh slash (`/`) để điều khiển trò chơi.\n\n" +
            "1. **Tạo phòng:** `/flip7 start`\n" +
            "2. **Vào phòng:** `/flip7 join` (Tối đa 4 người)\n" +
            "3. **Bắt đầu:** `/flip7 begin` (Chủ phòng)\n" +
            "4. **Chơi theo lượt:** Dùng nút **Rút bài (Hit)** hoặc **Dừng (Stay)**.\n" +
            "5. **Lệnh khác:** `/flip7 leave`, `/flip7 status`"
        );
        container.addTextDisplayComponents(howToPlayTitle);
        container.addTextDisplayComponents(howToPlayText);
        container.addSeparatorComponents(new SeparatorBuilder());

        const closingText = new TextDisplayBuilder().setContent(
            "Chúc mọi người chơi game vui vẻ và giành được nhiều điểm! Mọi góp ý xin vui lòng nhắn tin trực tiếp cho người quản lý. Cảm ơn các bạn!"
        );
        container.addTextDisplayComponents(closingText);

        try {
            await targetChannel.send({
                // Xóa content: '@everyone' khỏi đây
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });
            await interaction.reply({ content: `Thông báo đã được gửi thành công đến kênh ${targetChannel}.`, ephemeral: true });
        } catch (error) {
            console.error('Không thể gửi thông báo:', error);
            await interaction.reply({ content: 'Đã xảy ra lỗi khi cố gắng gửi thông báo.', ephemeral: true });
        }
    },
}; 