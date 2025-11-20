const { GameRun } = tables;

export class Game extends Resource {
	static loadAsInstance = false;

	async post(content, request) {
		try {
			// Handle argument shifting if content is the context
			if (content && content.pathname && request) {
				content = request;
			}

			const { playerName, score, durationSeconds } = content;
			if (!playerName || score === undefined || durationSeconds === undefined) {
				return { error: 'Missing required fields', received: content };
			}

			if (score < 0 || durationSeconds < 0) {
				return { error: 'Invalid score or duration' };
			}

			const result = await GameRun.create({
				playerName,
				score,
				durationSeconds
			});
			return result;
		} catch (e) {
			return { error: e.message };
		}
	}

	async get(query, request) {
		let url = this.url || (request && request.url) || (request && request.pathname) || '';

		// If url is still empty, maybe it's in the query context?
		if (!url && query && query.pathname) {
			url = query.pathname;
		}

		const action = url.split('/').pop();

		if (url.endsWith('/top-runs') || action === 'top-runs') {
			const limit = parseInt(query.get('limit')) || 10;
			const runs = await GameRun.search({
				attributes: ['id', 'playerName', 'score', 'createdAt'],
				sort: { attribute: 'score', descending: true },
				limit: limit
			});
			return runs;
		}

		if (url.endsWith('/leaderboard-cumulative') || action === 'leaderboard-cumulative') {
			const limit = parseInt(query.get('limit')) || 10;
			const allRuns = await GameRun.search({
				attributes: ['playerName', 'score', 'createdAt']
			});

			const playerStats = {};
			for (const run of allRuns) {
				if (!playerStats[run.playerName]) {
					playerStats[run.playerName] = {
						playerName: run.playerName,
						bestScore: 0,
						totalScore: 0,
						runCount: 0,
						lastPlayedAt: 0
					};
				}
				const stats = playerStats[run.playerName];
				stats.bestScore = Math.max(stats.bestScore, run.score);
				stats.totalScore += run.score;
				stats.runCount++;
				stats.lastPlayedAt = Math.max(stats.lastPlayedAt, run.createdAt);
			}

			const sortedStats = Object.values(playerStats).sort((a, b) => {
				return b.totalScore - a.totalScore;
			});

			return sortedStats.slice(0, limit);
		}

		if (url.endsWith('/player-runs') || action === 'player-runs') {
			const playerName = query.get('playerName');
			const limit = parseInt(query.get('limit')) || 20;
			if (!playerName) return { error: 'playerName required' };

			const runs = await GameRun.search({
				conditions: [
					{ attribute: 'playerName', value: playerName }
				],
				sort: { attribute: 'createdAt', descending: true },
				limit: limit
			});
			return runs;
		}

		return { error: 'Unknown endpoint', url: url, keys: request ? Object.keys(request) : [] };
	}
}