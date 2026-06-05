# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tmp-online-all-games.spec.js >> online all games can finish with simulated browser players
- Location: tmp-online-all-games.spec.js:464:1

# Error details

```
Error: guandan: action pass failed for PW-mq0d24s2-guandan-1: emit_timeout:game:action
```

# Test source

```ts
  332 | 
  333 |   if (gameKey === 'doudizhu') {
  334 |     if (state.phase === 'bid' && state.currentPlayer === id) {
  335 |       return state.currentBid ? { type: 'pass' } : { type: 'bid', score: 1 };
  336 |     }
  337 |     if (state.phase !== 'play' || state.currentPlayer !== id) return null;
  338 |     if (state.lastPattern && state.lastLeadPlayer !== id) return { type: 'pass' };
  339 |     const hand = state.hands?.[id] || [];
  340 |     return hand[0] ? { type: 'play', cards: [hand[0]] } : null;
  341 |   }
  342 | 
  343 |   if (gameKey === 'guandan') {
  344 |     if (state.phase === 'round_finished' && index === 0) return { type: 'next_round' };
  345 |     if (state.phase !== 'play' || state.currentPlayer !== id) return null;
  346 |     if (state.lastPattern && state.lastLeadPlayer !== id) {
  347 |       const hints = Array.isArray(state.currentHints) ? state.currentHints : [];
  348 |       const bestHint = hints
  349 |         .filter((item) => Array.isArray(item.cards) && item.cards.length > 0)
  350 |         .sort((a, b) => b.cards.length - a.cards.length)[0];
  351 |       return bestHint ? { type: 'play', cards: bestHint.cards } : { type: 'pass' };
  352 |     }
  353 |     const hand = state.hands?.[id] || [];
  354 |     return hand[0] ? { type: 'play', cards: [hand[0]] } : null;
  355 |   }
  356 | 
  357 |   if (gameKey === 'mahjong') {
  358 |     if (state.phase === 'draw' && state.currentPlayer === id) return { type: 'draw_done' };
  359 |     if (state.phase === 'discard' && state.currentPlayer === id) {
  360 |       const hand = state.hands?.[id] || [];
  361 |       const card = hand[hand.length - 1] || hand[0];
  362 |       return card ? { type: 'discard', card } : null;
  363 |     }
  364 |     if (state.phase === 'response') {
  365 |       const pending = state.pendingAction;
  366 |       if (pending?.type === 'self' && pending.playerId === id) return { type: 'pass' };
  367 |       if (pending?.queue?.[0]?.playerId === id) return { type: 'pass' };
  368 |     }
  369 |   }
  370 | 
  371 |   return null;
  372 | }
  373 | 
  374 | async function driveGame(game, players) {
  375 |   const startedAt = Date.now();
  376 |   const actionLog = [];
  377 |   let idleTicks = 0;
  378 |   let nextProgressAt = startedAt + 30000;
  379 | 
  380 |   while (Date.now() - startedAt < game.timeoutMs) {
  381 |     const snaps = await snapshots(players);
  382 |     const finished = snaps.find((snap) => snap.room?.status === 'finished');
  383 |     if (finished) {
  384 |       return {
  385 |         key: game.key,
  386 |         ok: true,
  387 |         elapsedMs: Date.now() - startedAt,
  388 |         finalPhase: finished.game?.phase,
  389 |         finalStatus: finished.room?.status,
  390 |         winner: finished.game?.finalWinner || finished.game?.winner || null,
  391 |         winningPlayers: finished.game?.winningPlayers || [],
  392 |         actions: actionLog.length
  393 |       };
  394 |     }
  395 |     const phaseFinished = snaps.find((snap) => snap.game?.phase === 'finished');
  396 |     if (phaseFinished) {
  397 |       await sleep(500);
  398 |       continue;
  399 |     }
  400 | 
  401 |     const commonState = publicState(snaps, players);
  402 |     if (Date.now() >= nextProgressAt) {
  403 |       console.log(`[PROGRESS] ${game.key} phase=${commonState?.phase || 'n/a'} stage=${commonState?.stage || 'n/a'} current=${commonState?.currentPlayer || 'n/a'} actions=${actionLog.length}`);
  404 |       nextProgressAt = Date.now() + 30000;
  405 |     }
  406 |     const actions = [];
  407 | 
  408 |     for (let i = 0; i < players.length; i += 1) {
  409 |       const isMember = roomHasPlayer(snaps[i]?.room, players[i].playerInfo.id);
  410 |       if (players[i].active === false || isMember === false) {
  411 |         players[i].active = false;
  412 |         continue;
  413 |       }
  414 |       const ownState = snaps[i]?.game || commonState;
  415 |       const state = ['doudizhu', 'guandan', 'mahjong'].includes(game.key) ? ownState : commonState;
  416 |       const action = ['doudizhu', 'guandan', 'mahjong'].includes(game.key)
  417 |         ? actionForCardGame(game.key, players[i], i, state)
  418 |         : actionForPlayer(game.key, players[i], i, state);
  419 |       if (action) actions.push({ player: players[i], action });
  420 |     }
  421 | 
  422 |     if (actions.length) {
  423 |       idleTicks = 0;
  424 |       for (const item of actions) {
  425 |         const response = await emit(item.player, 'game:action', { action: item.action });
  426 |         actionLog.push({
  427 |           player: item.player.nickname,
  428 |           action: item.action.type,
  429 |           error: response.error || null
  430 |         });
  431 |         if (response.error) {
> 432 |           throw new Error(`${game.key}: action ${item.action.type} failed for ${item.player.nickname}: ${response.error}`);
      |                 ^ Error: guandan: action pass failed for PW-mq0d24s2-guandan-1: emit_timeout:game:action
  433 |         }
  434 |         await sleep(80);
  435 |       }
  436 |     } else {
  437 |       idleTicks += 1;
  438 |       await sleep(idleTicks > 20 ? 1000 : 250);
  439 |     }
  440 |   }
  441 | 
  442 |   const last = await snapshots(players);
  443 |   return {
  444 |     key: game.key,
  445 |     ok: false,
  446 |     elapsedMs: Date.now() - startedAt,
  447 |     last: last.map((snap, index) => ({
  448 |       player: snap.player?.nickname,
  449 |       playerId: snap.player?.id,
  450 |       expectedId: players[index]?.playerInfo.id,
  451 |       roomStatus: snap.room?.status,
  452 |       phase: snap.game?.phase,
  453 |       stage: snap.game?.stage,
  454 |       currentPlayer: snap.game?.currentPlayer,
  455 |       handCount: snap.game?.hands?.[snap.player?.id]?.length,
  456 |       events: snap.events?.slice(-6)
  457 |     })),
  458 |     actions: actionLog.length
  459 |   };
  460 | }
  461 | 
  462 | test.setTimeout(20 * 60 * 1000);
  463 | 
  464 | test('online all games can finish with simulated browser players', async ({ browser }) => {
  465 |   const runId = `${Date.now().toString(36)}`;
  466 |   const results = [];
  467 | 
  468 |   for (const game of SELECTED_GAMES) {
  469 |     const players = await setupRoom(browser, game, runId);
  470 |     try {
  471 |       const result = await driveGame(game, players);
  472 |       results.push(result);
  473 |       console.log(`[${result.ok ? 'OK' : 'FAIL'}] ${game.key} ${JSON.stringify(result)}`);
  474 |       if (!result.ok) throw new Error(`${game.key} did not finish: ${JSON.stringify(result.last)}`);
  475 |     } finally {
  476 |       await Promise.all(players.map((player) => player.context.close().catch(() => null)));
  477 |     }
  478 |   }
  479 | 
  480 |   console.log(`ONLINE_ALL_GAMES_RESULT ${JSON.stringify(results, null, 2)}`);
  481 | });
  482 | 
```