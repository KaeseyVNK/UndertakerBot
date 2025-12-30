const { Events } = require('discord.js');
const Database = require('better-sqlite3');
const gameManager = require('../game/GameManager');

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 1 * 60 * 1000;     // 1 minute

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        // Initialize database
        client.db = new Database('data/database.sqlite');

        // Create users table if not exists
        client.db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			user_id TEXT PRIMARY KEY,
			full_name TEXT,
			birthday TEXT,
			gender TEXT,
			about_me TEXT,
			thumbnail_url TEXT,
			banner_url TEXT
		)
	`);

		// Start the inactivity checker
		setInterval(async () => {
			const activeGames = gameManager.getAllGames();
			if (activeGames.size === 0) return;

			console.log(`[Inactivity Check] Checking ${activeGames.size} active games...`);

			for (const [channelId, game] of activeGames.entries()) {
				const timeSinceLastActivity = Date.now() - game.lastActivity;

				if (timeSinceLastActivity > INACTIVITY_TIMEOUT_MS) {
					console.log(`[Inactivity Check] Game in channel ${channelId} timed out. Ending game.`);
					gameManager.endGame(channelId);
					
					try {
						const channel = await client.channels.fetch(channelId);
						if (channel) {
							await channel.send({ content: 'Phòng chơi Flip 7 đã được tự động đóng do không có hoạt động trong hơn 5 phút.' });
						}
					} catch (error) {
						console.error(`[Inactivity Check] Failed to send timeout message to channel ${channelId}:`, error);
					}
				}
			}
		}, CHECK_INTERVAL_MS);
    },
}; 