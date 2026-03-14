import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { getTasteLeaderboard } from '../services/recommender';

export const data = new SlashCommandBuilder()
  .setName('tasteleaderboard')
  .setDescription('See who has the most obscure, energetic, or chill music taste on this server');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const { mostObscure, mostEnergetic, mostChill } = await getTasteLeaderboard();

    const formatList = (entries: Array<{ username: string; value: number }>, unit = '%') =>
      entries.length > 0
        ? entries
            .map((e, i) => `${i + 1}. **${e.username}** — ${Math.round(e.value)}${unit}`)
            .join('\n')
        : 'No data yet';

    const embed = new EmbedBuilder()
      .setTitle('🏆 Server Taste Leaderboard')
      .setColor(0x1db954)
      .addFields(
        {
          name: '🕵️ Most Obscure Listeners',
          value: formatList(mostObscure),
          inline: false,
        },
        {
          name: '⚡ Most Energetic Taste',
          value: formatList(mostEnergetic),
          inline: false,
        },
        {
          name: '🌊 Most Chill Taste',
          value: formatList(mostChill),
          inline: false,
        }
      )
      .setFooter({ text: 'Scores computed from Spotify audio features' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('tasteLeaderboard error:', err);
    await interaction.editReply('❌ Something went wrong fetching the leaderboard.');
  }
}
