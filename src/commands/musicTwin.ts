import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { getMusicTwin } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('musictwin')
  .setDescription('Find the person in this server who has the most similar music taste to you');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const discordId = interaction.user.id;

  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE discord_id = $1`,
      [discordId]
    );

    if (userResult.rows.length === 0) {
      await interaction.editReply(
        '❌ You haven\'t registered a playlist yet. Use `/addplaylist <url>` first!'
      );
      return;
    }

    const userId: number = userResult.rows[0].id;
    const twin = await getMusicTwin(userId);

    if (!twin) {
      await interaction.editReply(
        '🎵 No music twin found yet. More users need to register their playlists!'
      );
      return;
    }

    const similarityPct = Math.round(twin.similarity * 100);

    const embed = new EmbedBuilder()
      .setTitle('🎧 Your Music Twin')
      .setColor(0x1db954)
      .setDescription(
        `Based on audio feature similarity across your playlists:`
      )
      .addFields(
        { name: '👤 Twin', value: twin.username, inline: true },
        { name: '💯 Similarity', value: `${similarityPct}%`, inline: true }
      )
      .setFooter({ text: 'Use /compatibility @user to compare with someone specific' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('musicTwin error:', err);
    await interaction.editReply('❌ Something went wrong finding your music twin.');
  }
}
