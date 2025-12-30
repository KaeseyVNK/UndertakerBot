const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore messages from other bots
	if (message.author.bot) return;

	// Check for penalty keywords from the target user
	const { targetUserId, penaltyKeywords } = require('../../config.js');
	if (message.author.id === targetUserId) {
		const messageContent = message.content.toLowerCase();

		// Prioritize checking for 'pio'
		if (messageContent.includes('pio')) {
			try {
				await message.reply(`Nhắc tới Pio, thì Pio chỉ có thể là gà`);
			}
			catch (error) {
				console.error('Failed to send Pio reply:', error);
			}
		}
		else {
			// If 'pio' is not present, check for other penalty keywords
			for (const keyword of penaltyKeywords) {
				if (messageContent.includes(keyword)) {
					try {
						await message.reply('Đóng phạt 500k đi bạn, đừng nói nhiều nữa');
						break; // Stop after the first penalty
					}
					catch (error) {
						console.error('Failed to send penalty reply:', error);
					}
				}
			}
		}
	}

	switch (message.content.toLowerCase()) {
		case 'pio ancut':
			await message.reply(`Không được dành của Hmi Pio à`);
			break;
		case 'hmi ancut':
			await message.reply(`Chuẩn ln Không cần phải chỉnh luôn ${message.author}`);
			break;
		case 'Pio':
			await message.reply(`Gà`);
			break;
		case 'pio':
			await message.reply(`Gà`);
			break;
		case 'Cứt':
			await message.reply(`Dơ quá ${message.author}`);
			break;
		case 'cứt':
			await message.reply(`Dơ quá ${message.author}`);
			break;
		case 'Cut':
			await message.reply(`Dơ quá ${message.author}`);
			break;
		
	}

	// Respond to "Hmi ancut"
	// if (message.content.toLowerCase() === 'pio ancut' || message.content.toLowerCase() === 'hmi ancut') 
	// {
	// 	try {
	// 		const mention = 
	// 		await message.reply(`Chuẩn ln Không cần phải chỉnh luôn ${message.author}`);
	// 	}
	// 	catch (error) {
	// 		console.error('Failed to send reply:', error);
	// 	}
	// }
    },
}; 