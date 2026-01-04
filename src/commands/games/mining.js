const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');

const MAX_ENERGY = 20;
const REGEN_RATE_MS = 6 * 60 * 1000; // 6 minutes per energy

const UPGRADE_COSTS = {
    2: { iron: 50, gold: 0, diamond: 0, name: 'Cúp Sắt' },
    3: { iron: 100, gold: 50, diamond: 0, name: 'Cúp Kim Cương' }
};

const PICKAXE_NAMES = {
    1: 'Cúp Gỗ',
    2: 'Cúp Sắt',
    3: 'Cúp Kim Cương'
};

function getEnergy(row) {
    if (!row) return MAX_ENERGY;
    const now = Date.now();
    const lastUpdate = row.last_energy_update || now;
    const elapsed = now - lastUpdate;
    const recovered = Math.floor(elapsed / REGEN_RATE_MS);
    return Math.min(MAX_ENERGY, row.energy + recovered);
}

function getMiningReward(level) {
    const rand = Math.random() * 100;
    
    // Level 1: Wood
    if (level === 1) {
        if (rand < 60) return { type: 'iron', amount: 1, name: 'Sắt ⚪' };
        if (rand < 70) return { type: 'gold', amount: 1, name: 'Vàng 🟡' };
        if (rand < 71) return { type: 'diamond', amount: 1, name: 'Kim Cương 💎' }; // 1%
        return { type: null, amount: 0, name: 'Đá cuội (Không có gì) 🪨' };
    }
    
    // Level 2: Iron
    if (level === 2) {
        if (rand < 50) return { type: 'iron', amount: Math.floor(Math.random() * 2) + 1, name: 'Sắt ⚪' };
        if (rand < 75) return { type: 'gold', amount: 1, name: 'Vàng 🟡' };
        if (rand < 80) return { type: 'diamond', amount: 1, name: 'Kim Cương 💎' }; // 5%
        return { type: null, amount: 0, name: 'Đá cuội (Không có gì) 🪨' };
    }

    // Level 3: Diamond
    if (level === 3) {
        if (rand < 40) return { type: 'iron', amount: Math.floor(Math.random() * 3) + 1, name: 'Sắt ⚪' };
        if (rand < 70) return { type: 'gold', amount: Math.floor(Math.random() * 2) + 1, name: 'Vàng 🟡' };
        if (rand < 85) return { type: 'diamond', amount: 1, name: 'Kim Cương 💎' }; // 15%
        return { type: null, amount: 0, name: 'Đá cuội (Không có gì) 🪨' };
    }

    return { type: null, amount: 0 };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mine')
        .setDescription('Hệ thống mini-game Đế Chế Đào Mỏ')
        .addSubcommand(subcommand =>
            subcommand
                .setName('action')
                .setDescription('Thực hiện đào tài nguyên (Tốn 1 Năng lượng)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Xem thông tin tài sản và năng lượng'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('upgrade')
                .setDescription('Nâng cấp Cúp để đào được nhiều đồ xịn hơn'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Xem bảng xếp hạng đại gia')),
    async execute(interaction) {
        const db = interaction.client.db;
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        // Ensure profile exists
        let row = db.prepare('SELECT * FROM mining_profiles WHERE user_id = ?').get(userId);
        if (!row) {
            db.prepare('INSERT INTO mining_profiles (user_id, last_energy_update) VALUES (?, ?)').run(userId, Date.now());
            row = { user_id: userId, energy: MAX_ENERGY, last_energy_update: Date.now(), iron: 0, gold: 0, diamond: 0, pickaxe_level: 1 };
        }

        if (subcommand === 'action') {
            const currentEnergy = getEnergy(row);

            // Bước 1: Kiểm tra năng lượng
            if (currentEnergy < 1) {
                const now = Date.now();
                const lastUpdate = row.last_energy_update || now;
                const timeToNext = REGEN_RATE_MS - ((now - lastUpdate) % REGEN_RATE_MS);
                const minutes = Math.ceil(timeToNext / 60000);
                
                return interaction.reply({ content: `🚫 Bạn đã hết năng lượng! Vui lòng đợi ${minutes} phút để hồi phục 1 năng lượng.`, ephemeral: true });
            }

            // Chuẩn bị tính toán thời gian hồi phục để bảo toàn progress
            const now = Date.now();
            const elapsed = now - (row.last_energy_update || now);
            const remainder = elapsed % REGEN_RATE_MS;

            // Bước 2: Trừ 1 năng lượng cơ bản
            let energyAfterBaseCost = currentEnergy - 1;

            // Bước 3: Random Event
            const eventRoll = Math.random() * 100;
            let eventType = 'normal';
            let message = '';
            let color = 0xA9A9A9; // Grey default
            let rewardMultiplier = 1;
            let energyChange = 0;
            let goldLossPercent = 0;

            // Tỷ lệ: 70% Normal | 10% x2 | 5% Heal | 10% CaveIn | 5% Goblin
            if (eventRoll < 70) {
                eventType = 'normal';
                color = 0x808080; // Grey
            } else if (eventRoll < 80) { // 10% May mắn x2
                eventType = 'lucky_x2';
                rewardMultiplier = 2;
                message = '🌟 **MAY MẮN!** Bạn trúng mạch khoáng sản! Tài nguyên nhận được x2!';
                color = 0x00FF00; // Green
            } else if (eventRoll < 85) { // 5% Suối nước thần
                eventType = 'lucky_heal';
                energyChange = 3;
                message = '💧 **MAY MẮN!** Bạn tìm thấy Suối Nước Thần! Hồi phục ngay 3 năng lượng!';
                color = 0x00FFFF; // Cyan
            } else if (eventRoll < 95) { // 10% Sập hầm
                eventType = 'unlucky_cavein';
                energyChange = -2;
                message = '⚠️ **XUI XẺO!** Hầm mỏ bị sập! Bạn mất thêm 2 năng lượng để thoát thân!';
                color = 0xFF0000; // Red
            } else { // 5% Goblin
                eventType = 'unlucky_goblin';
                goldLossPercent = 0.1;
                message = '👺 **XUI XẺO!** Goblin xuất hiện và trộm 10% số vàng của bạn!';
                color = 0xFFA500; // Orange
            }

            // Bước 4: Tính tài nguyên
            let finalReward = { type: null, amount: 0, name: '' };

            if (eventType === 'normal' || eventType === 'lucky_x2') {
                finalReward = getMiningReward(row.pickaxe_level);
                if (finalReward.type) {
                    finalReward.amount *= rewardMultiplier;
                }
            }

            // Tính năng lượng cuối cùng
            let finalEnergy = energyAfterBaseCost + energyChange;
            if (finalEnergy > MAX_ENERGY) finalEnergy = MAX_ENERGY;
            if (finalEnergy < 0) finalEnergy = 0;

            // Cập nhật thời gian hồi phục
            let newLastUpdate;
            if (finalEnergy >= MAX_ENERGY) {
                newLastUpdate = now;
            } else {
                newLastUpdate = now - remainder;
            }

            // Bước 5: Lưu DB và trả lời
            let updateQuery = 'UPDATE mining_profiles SET energy = ?, last_energy_update = ?';
            const params = [finalEnergy, newLastUpdate];
            
            let description = message ? `${message}\n\n` : '';

            // Xử lý phần thưởng
            if (finalReward.type) {
                updateQuery += `, ${finalReward.type} = ${finalReward.type} + ?`;
                params.push(finalReward.amount);
                description += `Bạn đã đào được: **${finalReward.name}** ${finalReward.amount > 0 ? `x${finalReward.amount}` : ''}\n`;
            } else if (eventType === 'normal' && !finalReward.type) {
                 description += `Bạn chỉ đào được: **${finalReward.name}**\n`;
            }

            // Xử lý mất vàng (Goblin)
            if (eventType === 'unlucky_goblin') {
                const lostGold = Math.floor(row.gold * goldLossPercent);
                if (lostGold > 0) {
                    updateQuery += `, gold = MAX(0, gold - ?)`;
                    params.push(lostGold);
                    description += `💸 Bạn bị mất **${lostGold}** Vàng!\n`;
                } else {
                    description += `💸 Goblin lục túi nhưng bạn không có đồng nào!\n`;
                }
            }
            
            updateQuery += ' WHERE user_id = ?';
            params.push(userId);
            
            db.prepare(updateQuery).run(...params);

            // --- BUILD CONTAINER ---
            const container = new ContainerBuilder().setAccentColor(color);
            
            const title = new TextDisplayBuilder().setContent(eventType.includes('unlucky') ? '# ⛏️ Tai nạn hầm mỏ!' : (eventType.includes('lucky') ? '# ⛏️ Sự kiện may mắn!' : '# ⛏️ Kết quả đào mỏ'));
            container.addTextDisplayComponents(title);
            container.addSeparatorComponents(new SeparatorBuilder());

            const resultText = new TextDisplayBuilder().setContent(description);
            container.addTextDisplayComponents(resultText);
            
            container.addSeparatorComponents(new SeparatorBuilder());
            
            const energyText = new TextDisplayBuilder().setContent(`⚡ Năng lượng: ${currentEnergy} -> **${finalEnergy}/${MAX_ENERGY}**`);
            container.addTextDisplayComponents(energyText);

            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (subcommand === 'stats') {
            const currentEnergy = getEnergy(row);
            
            let barLength = 10;
            let filled = Math.round((currentEnergy / MAX_ENERGY) * barLength);
            let empty = barLength - filled;
            let bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);

            // Wealth calculation
            const wealth = (row.iron * 10) + (row.gold * 50) + (row.diamond * 100) + (row.pickaxe_level * 1000);

            const container = new ContainerBuilder().setAccentColor(0x0099FF);
            
            const title = new TextDisplayBuilder().setContent(`# 🏰 Hồ sơ Đế Chế Đào Mỏ`);
            container.addTextDisplayComponents(title);
            container.addSeparatorComponents(new SeparatorBuilder());

            const userSection = new SectionBuilder();
            const userInfo = new TextDisplayBuilder().setContent(
                `**${interaction.user.username}**\n` +
                `💰 Tài sản: **${wealth.toLocaleString()}**\n` +
                `⛏️ Cúp: **${PICKAXE_NAMES[row.pickaxe_level]}** (Lv.${row.pickaxe_level})`
            );
            userSection.addTextDisplayComponents(userInfo);
            
            try {
                const avatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 128 });
                const thumbnail = new ThumbnailBuilder({ media: { url: avatarURL } });
                userSection.setThumbnailAccessory(thumbnail);
            } catch (e) {
                console.error(e);
            }
            container.addSectionComponents(userSection);
            container.addSeparatorComponents(new SeparatorBuilder());

            const inventoryText = new TextDisplayBuilder().setContent(
                `**🎒 Kho đồ:**\n` +
                `⚪ Sắt: ${row.iron}\n` +
                `🟡 Vàng: ${row.gold}\n` +
                `💎 Kim Cương: ${row.diamond}`
            );
            container.addTextDisplayComponents(inventoryText);
            container.addSeparatorComponents(new SeparatorBuilder());

            const energyText = new TextDisplayBuilder().setContent(`⚡ Năng lượng: ${bar} (${currentEnergy}/${MAX_ENERGY})`);
            container.addTextDisplayComponents(energyText);

            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (subcommand === 'upgrade') {
            const currentLevel = row.pickaxe_level;
            if (currentLevel >= 3) {
                return interaction.reply({ content: '🌟 Cúp của bạn đã đạt cấp tối đa!', ephemeral: true });
            }

            const nextLevel = currentLevel + 1;
            const cost = UPGRADE_COSTS[nextLevel];

            if (row.iron < cost.iron || row.gold < cost.gold || row.diamond < cost.diamond) {
                const missing = [];
                if (row.iron < cost.iron) missing.push(`${cost.iron - row.iron} Sắt`);
                if (row.gold < cost.gold) missing.push(`${cost.gold - row.gold} Vàng`);
                if (row.diamond < cost.diamond) missing.push(`${cost.diamond - row.diamond} Kim Cương`);
                
                return interaction.reply({ 
                    content: `❌ Không đủ tài nguyên để nâng cấp lên **${cost.name}**!\nCần thêm: ${missing.join(', ')}.`, 
                    ephemeral: true 
                });
            }

            // Perform upgrade
            db.prepare(`
                UPDATE mining_profiles 
                SET pickaxe_level = ?, iron = iron - ?, gold = gold - ?, diamond = diamond - ? 
                WHERE user_id = ?
            `).run(nextLevel, cost.iron, cost.gold, cost.diamond, userId);

            const container = new ContainerBuilder().setAccentColor(0x00FF00);
            const title = new TextDisplayBuilder().setContent('# ✅ Nâng Cấp Thành Công!');
            const desc = new TextDisplayBuilder().setContent(`Chúc mừng! Bạn đã nâng cấp lên **${cost.name}**! Tỷ lệ đào đồ xịn đã tăng lên!`);
            container.addTextDisplayComponents(title, desc);

            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        if (subcommand === 'leaderboard') {
            const allProfiles = db.prepare('SELECT * FROM mining_profiles').all();
            
            const sorted = allProfiles.map(p => {
                const wealth = (p.iron * 10) + (p.gold * 50) + (p.diamond * 100) + (p.pickaxe_level * 1000);
                return { ...p, wealth };
            }).sort((a, b) => b.wealth - a.wealth).slice(0, 10);

            const container = new ContainerBuilder().setAccentColor(0xFFD700);
            const title = new TextDisplayBuilder().setContent('# 🏆 Bảng Xếp Hạng Đại Gia');
            container.addTextDisplayComponents(title);
            container.addSeparatorComponents(new SeparatorBuilder());

            let description = '';
            for (let i = 0; i < sorted.length; i++) {
                const p = sorted[i];
                const userRow = db.prepare('SELECT full_name FROM users WHERE user_id = ?').get(p.user_id);
                const name = userRow ? userRow.full_name : `<@${p.user_id}>`;
                
                description += `**#${i + 1}** ${name} — 💰 ${p.wealth.toLocaleString()}\n`;
            }

            if (description === '') description = 'Chưa có ai chơi game này!';

            const list = new TextDisplayBuilder().setContent(description);
            container.addTextDisplayComponents(list);

            return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
