const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

            if (currentEnergy < 1) {
                const now = Date.now();
                const lastUpdate = row.last_energy_update || now;
                // Calculate time until next energy
                // stored + recovered = current (which is 0)
                // We need to wait until stored + recovered >= 1
                // Actually, currentEnergy is 0, meaning (now - lastUpdate) < REGEN_RATE_MS * (1 - row.energy?? no)
                // Let's simpler logic: Next energy is at last_update + (recovered + 1) * REGEN_RATE_MS ??
                // If current energy is 0, it means we used all stored energy and haven't recovered 1 yet.
                // The time until next point is: REGEN_RATE_MS - ((now - lastUpdate) % REGEN_RATE_MS)
                const timeToNext = REGEN_RATE_MS - ((now - lastUpdate) % REGEN_RATE_MS);
                const minutes = Math.ceil(timeToNext / 60000);
                
                return interaction.reply({ content: `🚫 Bạn đã hết năng lượng! Vui lòng đợi ${minutes} phút để hồi phục 1 năng lượng.`, ephemeral: true });
            }

            const reward = getMiningReward(row.pickaxe_level);
            
            // Update DB
            // We set energy to currentEnergy - 1.
            // Note: Since we calculated currentEnergy based on elapsed time, we need to update 'last_energy_update' carefully to not lose partial progress?
            // Actually, usually simpler: 
            // set energy = currentEnergy - 1
            // set last_energy_update = now - ((now - old_last_update) % REGEN_RATE_MS) ??
            // OR just set last_energy_update = now is fine IF we assume energy is discrete.
            // But prompt says: "Kiểm tra và cập nhật năng lượng dựa trên thời gian trôi qua"
            // Let's use the prompt's formula logic implicitly.
            // If I set last_energy_update = now, I reset the timer. This is standard for "claiming" the regen.
            // But if user has 19.9 energy (almost 20), and mines, they go to 19. 
            // If I reset timer to NOW, they lose the partial progress toward the next point.
            // Better: update `last_energy_update` so it reflects the "timestamp where energy was theoretically full or matches current calculation".
            // Let's stick to simple: Reset timer to NOW for the "consumed" energy? 
            // No, standard mobile game logic:
            // Stored Energy in DB is the snapshot.
            // Real Energy = Stored + Floor(Elapsed / Rate).
            // New Stored = Real - 1.
            // New Last Update: We should keep the "remainder" time.
            // New Last Update = Now - (Elapsed % Rate). This preserves progress to next point.
            
            const now = Date.now();
            const elapsed = now - (row.last_energy_update || now);
            const remainder = elapsed % REGEN_RATE_MS;
            // However, if we were at MAX, we don't have "remainder" effectively, or rather we start fresh.
            // If Real == MAX_ENERGY, then New Last Update = Now.
            
            let newLastUpdate;
            if (currentEnergy >= MAX_ENERGY) {
                newLastUpdate = now;
            } else {
                newLastUpdate = now - remainder;
            }

            let updateQuery = 'UPDATE mining_profiles SET energy = ?, last_energy_update = ?';
            const params = [currentEnergy - 1, newLastUpdate];

            if (reward.type) {
                updateQuery += `, ${reward.type} = ${reward.type} + ?`;
                params.push(reward.amount);
            }
            
            updateQuery += ' WHERE user_id = ?';
            params.push(userId);

            db.prepare(updateQuery).run(...params);

            const embed = new EmbedBuilder()
                .setColor(reward.type === 'diamond' ? 0x00FFFF : (reward.type === 'gold' ? 0xFFD700 : 0xA9A9A9))
                .setTitle('⛏️ Kết quả đào mỏ')
                .setDescription(`Bạn đã đào được: **${reward.name}** ${reward.amount > 0 ? `x${reward.amount}` : ''}\nNăng lượng còn lại: ${currentEnergy - 1}/${MAX_ENERGY} ⚡`);

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'stats') {
            const currentEnergy = getEnergy(row);
            const nextLevel = row.pickaxe_level + 1;
            const nextUpgrade = UPGRADE_COSTS[nextLevel];
            
            let barLength = 10;
            let filled = Math.round((currentEnergy / MAX_ENERGY) * barLength);
            let empty = barLength - filled;
            let bar = '🟩'.repeat(filled) + '⬜'.repeat(empty);

            // Wealth calculation
            const wealth = (row.iron * 10) + (row.gold * 50) + (row.diamond * 100) + (row.pickaxe_level * 1000);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🏰 Hồ sơ Đế Chế Đào Mỏ của ${interaction.user.username}`)
                .addFields(
                    { name: '⚡ Năng lượng', value: `${bar} (${currentEnergy}/${MAX_ENERGY})`, inline: false },
                    { name: '⛏️ Cúp', value: `${PICKAXE_NAMES[row.pickaxe_level]} (Level ${row.pickaxe_level})`, inline: true },
                    { name: '💰 Tài sản', value: `Tổng giá trị: ${wealth.toLocaleString()}`, inline: true },
                    { name: '🎒 Kho đồ', value: `⚪ Sắt: ${row.iron}\n🟡 Vàng: ${row.gold}\n💎 Kim Cương: ${row.diamond}`, inline: false }
                );
            
            return interaction.reply({ embeds: [embed] });
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

            return interaction.reply({ content: `✅ Chúc mừng! Bạn đã nâng cấp lên **${cost.name}**! Tỷ lệ đào đồ xịn đã tăng lên!` });
        }

        if (subcommand === 'leaderboard') {
            const allProfiles = db.prepare('SELECT * FROM mining_profiles').all();
            
            const sorted = allProfiles.map(p => {
                const wealth = (p.iron * 10) + (p.gold * 50) + (p.diamond * 100) + (p.pickaxe_level * 1000);
                return { ...p, wealth };
            }).sort((a, b) => b.wealth - a.wealth).slice(0, 10);

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏆 Bảng Xếp Hạng Đại Gia Đào Mỏ')
                .setTimestamp();

            let description = '';
            for (let i = 0; i < sorted.length; i++) {
                const p = sorted[i];
                // Try to get username from cache if possible, otherwise just ID or fetch async (but async in loop is slow)
                // Since this is a simple command, showing User ID or formatted mention is okay.
                // Or we can query the users table for name if available.
                const userRow = db.prepare('SELECT full_name FROM users WHERE user_id = ?').get(p.user_id);
                const name = userRow ? userRow.full_name : `<@${p.user_id}>`;
                
                description += `**#${i + 1}** ${name}\n💰 Tài sản: ${p.wealth.toLocaleString()} | ⛏️ Cúp Lvl ${p.pickaxe_level}\n\n`;
            }

            if (description === '') description = 'Chưa có ai chơi game này!';

            embed.setDescription(description);

            return interaction.reply({ embeds: [embed] });
        }
    }
};
