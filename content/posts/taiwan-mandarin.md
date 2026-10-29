---
title: An app that only speaks Taiwan Mandarin
date: 2026-10-29
description: Building 臺灣華語, a study app that follows the TOCFL path, and the tests that keep it from drifting toward the Mainland standard.
---

I'm learning Mandarin, and the Mandarin I need is Taiwan's: Traditional characters, Zhuyin, Taiwan vocabulary and Taiwan readings. Most study apps treat that as a setting. You switch the characters to Traditional and the rest stays Mainland: 地鐵 instead of 捷運, 垃圾 read *lājī* instead of *lèsè*.

So I built [臺灣華語](https://github.com/amangeldievkuu/taiwan-mandarin), an app that teaches Taiwan Mandarin and nothing else.

## Following the official path

The app follows the TOCFL, Taiwan's official Mandarin exam, from Novice 1 to Level 6. That's about 15,000 words. I didn't want to invent the curriculum, so the content is built from official and open sources at build time: the TOCFL and NAER word lists, CC-CEDICT for the dictionary, and Tatoeba for example sentences. A pipeline turns those into levels, glosses, examples and graded readers about life in Taiwan.

Reviews use FSRS, a modern spaced-repetition scheduler, with recognition, recall and listening modes. After enough reviews it fits its parameters to your own memory instead of an average learner's.

## Tests for the standard

The part I'm proudest of is a set of tests that fail the build when Mainland usage gets in.

Every example sentence, reader, note and Chinese string in the source goes through a text guard:

- It is run through OpenCC's Mainland-to-Taiwan conversion and must come back unchanged.
- It is checked against a list of Mainland words that OpenCC misses when they are already written in Traditional characters, like 出租車, 公交車 and 便利店.

A second guard checks readings. 垃圾 must never be *la1 ji1*, 星期 must never be *xing1 qi1*.

This matters more than it sounds. A lot of the example sentences are written with AI, and AI writes Mainland Mandarin by default. Without the guard, the app would slowly drift toward the standard it exists to avoid. With it, a sentence that says 地鐵 simply doesn't ship.

Stroke order follows the same rule. The open stroke data I use follows PRC stroke order. Characters I've checked against the Ministry of Education's reference use Taiwan stroke order. Every other character shows a small note saying its stroke order may differ from Taiwan's standard. Stroke data is never made up.

## Offline first

It's a PWA that works fully offline on a phone, an iPad or a desktop, with no account needed. Signing in only syncs progress between devices. The layout changes with the screen: a tab bar on the phone, split views on the iPad, keyboard shortcuts on the desktop. `Space` reveals, `1` to `4` rates.

There's also a streak plant: a plum tree in a celadon pot that grows with every day you study. Missing a day doesn't kill it. Come back within three days and the crack in the pot is mended with a gold seam, like kintsugi. Learning a language takes years, and an app shouldn't punish you for having a life.
