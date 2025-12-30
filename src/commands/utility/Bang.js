const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bang')
		.setDescription('You will be fired by me!'),
	async execute(interaction) {
		await interaction.reply('No Please, Forgive me!');
	},
};