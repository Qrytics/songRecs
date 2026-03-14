import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { pool } from '../db/schema';
import { getUserSimilarity } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('tastedistance')
  .setDescription('See how similar your music taste is to another user')
  .addUserOption((option) =>
    option.setName('user').setDescription('The user to compare with').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const discordId = interaction.user.id;
  const targetUser = interaction.options.getUser('user', true);

  if (targetUser.id === discordId) {
    await interaction.editReply('🤣 You have 100% similarity with yourself!');
    return;
  }

  try {
    const [userResult, targetResult] = await Promise.all([
      pool.query(`SELECT id, username FROM users WHERE discord_id = $1`, [discordId]),
      pool.query(`SELECT id, username FROM users WHERE discord_id = $1`, [targetUser.id]),
    ]);

    if (userResult.rows.length === 0) {
      await interaction.editReply('❌ You haven\'t registered a playlist yet. Use `/addplaylist` first!');
      return;
    }
    if (targetResult.rows.length === 0) {
      await interaction.editReply(`❌ **${targetUser.username}** hasn't registered a playlist yet.`);
      return;
    }

    const userId: number = userResult.rows[0].id;
    const targetId: number = targetResult.rows[0].id;

    const similarity = await getUserSimilarity(userId, targetId);
    const pct = Math.round(similarity * 100);

    let verdict = '';
    if (similarity >= 0.9) verdict = '🔥 You are basically music twins!';
    else if (similarity >= 0.75) verdict = '🎶 You have very similar tastes.';
    else if (similarity >= 0.5) verdict = '🎵 You share some common ground.';
    else if (similarity >= 0.25) verdict = '🎸 Your tastes are quite different.';
    else verdict = '🌍 You live in completely different music worlds!';

    const embed = new EmbedBuilder()
      .setTitle('🎵 Taste Distance')
      .setColor(pct > 75 ? 0x1db954 : pct > 50 ? 0xffa500 : 0xff4444)
      .addFields(
        { name: '👤 You', value: interaction.user.username, inline: true },
        { name: 'vs', value: '⚡', inline: true },
        { name: '👤 Them', value: targetUser.username, inline: true },
        { name: '💯 Similarity', value: `${pct}%`, inline: false },
        { name: '📊 Verdict', value: verdict, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('tasteDistance error:', err);
    await interaction.editReply('❌ Something went wrong comparing taste profiles.');
  }
}
