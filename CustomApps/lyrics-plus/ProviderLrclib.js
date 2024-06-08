const ProviderLrclib = (function () {
	const headers = {
		authority: "apic-desktop.musixmatch.com",
		cookie: "x-mxm-token-guid="
	};

	async function findLyrics(info) {
		   const cleanTitle = Utils.removeExtraInfo(Utils.removeSongFeat(Utils.normalize(info.title)));
		 let baseURL = "https://lrclib.net/api/search?q=" + encodeURIComponent(info.artist + " " + info.title);
		// alert(baseURL);
         let body = await Spicetify.CosmosAsync.get(baseURL);
		 const neAlbumName = Utils.normalize(info.album);
		 const expectedAlbumName = Utils.containsHanCharacter(neAlbumName) ? await Utils.toSimplifiedChinese(neAlbumName) : neAlbumName;
		
		const recreatedBody = [];

// Iterate over each item in the body array
body.forEach(function(item) {
    // Check if syncedLyrics is true
    if (item.syncedLyrics) {
        // Add the item to the recreatedBody array
        recreatedBody.push(item);
    }
});

			
	const itemId = recreatedBody.findIndex(val => Utils.normalize(val.albumName) === expectedAlbumName  || Math.abs(info.duration - (val.duration*1000)) < 1000);
	let isMatched = false;
	let id = -1;
               

               if (itemId === -1)  
			   recreatedBody.forEach(function(item) {
                        if (!isMatched) {	 
						
                           // if ((item.artistName === artist) & (item.name === title)) {
                             // if (Math.abs(info.duration - (item.duration*1000)  < 1000)){
							//if ((item.artistName.includes(info.artist)) & (item.name.includes( info.title))) {	
							 if (Utils.normalize(item.artistName) === info.artist || Math.abs(info.duration - (item.duration * 1000)) < 1000) {
                                isMatched = true;
                                id = item.id;
                           					
                        }
                    }
                });
				
				 
		 if (itemId === -1) 
baseURL = 'https://lrclib.net/api/get/' + id
      else			 
		baseURL = 'https://lrclib.net/api/get/' + recreatedBody[itemId].id;
	
		body = await Spicetify.CosmosAsync.get(baseURL);
		return body;
	}

	async function getKaraoke(body) {
		const meta = body?.["matcher.track.get"]?.message?.body;
		if (!meta) {
			return null;
		}

		if (!meta.track.has_richsync || meta.track.instrumental) {
			return null;
		}

		const baseURL = `https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?format=json&subtitle_format=mxm&app_id=web-desktop-app-v1.0&`;

		const params = {
			f_subtitle_length: meta.track.track_length,
			q_duration: meta.track.track_length,
			commontrack_id: meta.track.commontrack_id,
			usertoken: CONFIG.providers.musixmatch.token
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map(key => key + "=" + encodeURIComponent(params[key]))
				.join("&");

		let result = await CosmosAsync.get(finalURL, null, headers);

		if (result.message.header.status_code != 200) {
			return null;
		}

		result = result.message.body;

		const parsedKaraoke = JSON.parse(result.richsync.richsync_body).map(line => {
			const startTime = line.ts * 1000;
			const endTime = line.te * 1000;
			const words = line.l;

			const text = words.map((word, index, words) => {
				const wordText = word.c;
				const wordStartTime = word.o * 1000;
				const nextWordStartTime = words[index + 1]?.o * 1000;

				const time = !isNaN(nextWordStartTime) ? nextWordStartTime - wordStartTime : endTime - (wordStartTime + startTime);

				return {
					word: wordText,
					time
				};
			});
			return {
				startTime,
				text
			};
		});

		return parsedKaraoke;
	}

	function getSynced(body) {
		let originalSyncedLyrics = body.syncedLyrics;
          let lines = originalSyncedLyrics.split('\n');
               let newSyncedLyrics = [];
                let accumulatedTime = 0;

                lines.forEach(line => {
                    const matches = line.match(/^\[(\d+:\d+\.\d+)\](.*)/);
                    if (matches && matches.length === 3) {
                        const timeParts = matches[1].split(':');
                        const minutes = parseInt(timeParts[0]);
                        const seconds = parseFloat(timeParts[1]);
                        accumulatedTime = minutes * 60000 + seconds * 1000;
                        const text = matches[2];
                        newSyncedLyrics.push({
                            "text": text.trim(),
                            "startTime": accumulatedTime
                        });
                    }
                });
                let jsonString = JSON.stringify(newSyncedLyrics, null, 2);
                let synced = JSON.parse(jsonString).map(line => ({
                    text: line.text || "♪",
                    startTime: line.startTime
                }));
				//alert( JSON.stringify(synced));
                return synced;
	}

	function getUnsynced(body) {
		const meta = body?.["matcher.track.get"]?.message?.body;
		if (!meta) {
			return null;
		}

		const hasUnSynced = meta.track.has_lyrics || meta.track.has_lyrics_crowd;

		const isInstrumental = meta?.track?.instrumental;

		if (isInstrumental) {
			return [{ text: "♪ Instrumental ♪" }];
		} else if (hasUnSynced) {
			const lyrics = body["track.lyrics.get"]?.message?.body?.lyrics?.lyrics_body;
			if (!lyrics) {
				return null;
			}
			return lyrics.split("\n").map(text => ({ text }));
		}

		return null;
	}


	return { findLyrics, getKaraoke, getSynced, getUnsynced};
})();
