import { useState, useEffect, useRef, useCallback } from 'react'
import { Scene, getIntroDurationMs } from './components/board/Scene'
import { Board2D } from './components/board/Board2D'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'
import { DefeatFire } from './components/ui/DefeatFire'
import { AuthModal } from './components/ui/AuthModal'
import { LobbyPanel } from './components/ui/LobbyPanel'
import { useOnlineGame } from './hooks/useOnlineGame'
import type { OnlineStatus } from './hooks/useOnlineGame'
import { useLobby } from './hooks/useLobby'
import { useGameStore } from './store/gameStore'
import type { PlayerSide, GameMode, Difficulty, Rules } from './store/gameStore'
import { getBestMove } from './game/ai'
import { getBoardConfig } from './game/hnefatafl'
import { supabase } from './lib/supabase'

const fireCSS = `
body, button, input, select {
  font-family: 'MedievalSharp', serif;
}
@keyframes sceneFadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes fireFlicker {
  0%   { opacity: 0.35; }
  25%  { opacity: 0.45; }
  50%  { opacity: 0.30; }
  75%  { opacity: 0.42; }
  100% { opacity: 0.35; }
}
@keyframes scoreFlash {
  0%   { transform: scale(1);    text-shadow: none; }
  30%  { transform: scale(1.35); text-shadow: 0 0 12px rgba(255,200,80,0.95), 0 0 28px rgba(255,140,0,0.7); }
  60%  { transform: scale(1.15); text-shadow: 0 0 8px rgba(255,200,80,0.6); }
  100% { transform: scale(1);    text-shadow: none; }
}
@keyframes victoryPulse {
  0%   { opacity: 0.55; transform: scale(1);    }
  50%  { opacity: 0.90; transform: scale(1.06); }
  100% { opacity: 0.55; transform: scale(1);    }
}
@keyframes ember0 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  8%   { opacity:1; }
  30%  { transform: translate(var(--dx1),calc(var(--rise)*0.3)) rotate(var(--a1)); opacity:0.9; }
  60%  { transform: translate(var(--dx2),calc(var(--rise)*0.65))rotate(var(--a2)); opacity:0.5; }
  85%  { opacity:0.15; }
  100% { transform: translate(var(--dx3),var(--rise))            rotate(var(--a3)); opacity:0;  }
}
@keyframes ember1 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  6%   { opacity:1; }
  25%  { transform: translate(var(--dx2),calc(var(--rise)*0.25))rotate(var(--a2)); opacity:0.8; }
  55%  { transform: translate(var(--dx1),calc(var(--rise)*0.60))rotate(var(--a1)); opacity:0.4; }
  80%  { opacity:0.1; }
  100% { transform: translate(var(--dx3),var(--rise))            rotate(var(--a3)); opacity:0;  }
}
@keyframes ember2 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  10%  { opacity:1; }
  40%  { transform: translate(var(--dx3),calc(var(--rise)*0.40))rotate(var(--a3)); opacity:0.7; }
  70%  { transform: translate(var(--dx1),calc(var(--rise)*0.70))rotate(var(--a1)); opacity:0.3; }
  90%  { opacity:0.05; }
  100% { transform: translate(var(--dx2),var(--rise))            rotate(var(--a2)); opacity:0;  }
}
.score-panel__inner {
  width: 110px;
  box-sizing: border-box;
  padding: 14px !important;
}
.ui-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 52px;
  height: 52px;
  background: none;
  border: none;
  color: #e8d8b8;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}
.ui-button:hover { opacity: 0.7; }
.ui-button__icon { width: 22px; height: 22px; flex-shrink: 0; }
.ui-button__label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #c8b888; }
.ui-button__profile-dot { position: absolute; top: 8px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: #5dba85; border: 1.5px solid rgba(0,0,0,0.6); }
.profile-scroll__name { font-size: clamp(20px, 4vw, 30px); letter-spacing: 3px; text-transform: uppercase; color: #2e1606; margin: 8px 0; }
.profile-scroll__name-row { display: flex; align-items: center; gap: 12px; justify-content: center; margin: 8px 0; }
.profile-scroll__edit-btn { background: none; border: 1px solid #a07840; color: #a07840; font-family: inherit; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; padding: 3px 10px; cursor: pointer; border-radius: 3px; transition: opacity 0.2s; }
.profile-scroll__edit-btn:hover { opacity: 0.7; }
.profile-scroll__edit-name { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 8px 0; }
.auth-modal__input.profile-scroll__name-input { max-width: 220px; text-align: center; color: #2e1606; background: rgba(255,255,255,0.7); border-color: rgba(100,60,10,0.3); }
.profile-scroll__name-actions { display: flex; gap: 8px; justify-content: center; }
.profile-scroll__stat-block { margin: 10px 0; text-align: center; }
.profile-scroll__stat-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2e1606; margin-bottom: 4px; }
.profile-scroll__stat-row { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: clamp(14px, 2.5vw, 20px); letter-spacing: 1px; margin: 2px 0; }
.profile-scroll__stat-type { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #7a5228; width: 80px; text-align: right; }
.profile-scroll__stat-win { color: #3a7a3a; }
.profile-scroll__stat-sep { color: #7a5228; }
.profile-scroll__stat-loss { color: #7a2020; }
.profile-scroll__elo { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin: 6px 0 2px; }
.profile-scroll__elo-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #a07840; }
.profile-scroll__elo-value { font-size: 28px; color: #c8880a; letter-spacing: 1px; font-weight: 600; }
.leaderboard__my-rank { text-align: center; font-size: 13px; color: #a07840; margin: 0 0 12px; letter-spacing: 0.5px; }
.leaderboard__my-rank strong { color: #c8880a; }
.leaderboard__table { display: flex; flex-direction: column; gap: 0; width: 100%; }
.leaderboard__header { display: flex; padding: 6px 10px; border-bottom: 1px solid rgba(100,60,10,0.25); margin-bottom: 4px; }
.leaderboard__header .leaderboard__col { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #a07840; }
.leaderboard__row { display: flex; align-items: center; padding: 8px 10px; border-radius: 4px; transition: background 0.15s; }
.leaderboard__row:hover { background: rgba(100,60,10,0.08); }
.leaderboard__row--me { background: rgba(200,136,10,0.12); border-radius: 4px; }
.leaderboard__row--me .leaderboard__col--name { color: #c8880a; font-weight: 600; }
.leaderboard__col { font-size: 13px; color: #3a1e06; }
.leaderboard__col--rank { width: 36px; flex-shrink: 0; color: #a07840; font-size: 12px; }
.leaderboard__col--name { flex: 1; }
.leaderboard__col--elo { width: 52px; text-align: right; flex-shrink: 0; font-weight: 600; color: #c8880a; font-size: 14px; }
.profile-scroll__summary { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin: 12px 0 4px; }
.profile-scroll__summary-wins { font-size: clamp(26px, 5vw, 38px); color: #3a7a3a; letter-spacing: 1px; }
.profile-scroll__summary-sep { font-size: clamp(18px, 3vw, 26px); color: #7a5228; }
.profile-scroll__summary-losses { font-size: clamp(26px, 5vw, 38px); color: #7a2020; letter-spacing: 1px; }
.profile-scroll__summary-rate { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #7a5228; margin-left: 8px; }
.menu-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  pointer-events: none;
  transition: opacity 0.4s ease;
  overflow-y: auto;
  overflow-x: hidden;
}
.menu-overlay--visible { pointer-events: auto; }
.menu-overlay__screens {
  position: relative;
  width: 100%;
  padding: 20px;
  max-width: 320px;
}
@media (min-width: 1024px) {
  .menu-overlay__screens { margin-top: 100px; }
}
.menu-overlay__screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  transition: opacity 0.25s ease;
}
.menu-overlay__screen--hidden {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.menu-overlay__item {
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 6px;
  color: #e8d8b8;
  padding: 8px 14px;
  font-size: 14px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font-family: inherit;
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}
.menu-overlay__item:hover { border-color: rgba(200,160,40,0.9); background: rgba(30,15,0,0.9); }
.menu-overlay__item--primary {
  background: linear-gradient(135deg, #a07820, #5a3e08, #a07820);
  border-color: #c89a30;
  color: #fff;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0,0,0,0.4);
}
.menu-overlay__item--primary:hover { background: linear-gradient(135deg, #e0b840, #a07018, #e0b840); border-color: #f0d060; }
.menu-overlay__item--primary:disabled { background: rgba(200,160,40,0.15); color: #e8d8b8; text-shadow: none; }
.menu-overlay__row { display: flex; gap: 8px; width: 100%; }
.menu-overlay__item--half { flex: 1; }
.settings-panel {
  width: 100%;
  background: rgba(0,0,0,0.88);
  border: 1px solid rgba(200,160,40,0.35);
  border-radius: 8px;
  overflow: hidden;
  padding: 10px;
}
.settings-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(200,160,40,0.2);
  cursor: pointer;
  transition: background 0.2s;
}
.settings-panel__header:hover { background: rgba(200,160,40,0.06); }
.settings-panel__back {
  color: #c8b888;
  display: flex;
  align-items: center;
}
.settings-panel__title {
  font-size: 13px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #e8d8b8;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 12px;
}
.settings-row:last-child { border-bottom: none; }
.settings-row--buttons { gap: 8px; padding: 8px 6px; }
.settings-row__label {
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #c8b888;
  flex-shrink: 0;
}
.credits-page {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: #120a03;
  font-family: 'MedievalSharp', cursive;
  color: #3d2008;
  overflow: hidden;
  animation: creditsEnter 0.9s ease-out forwards;
}
.credits-page--closing {
  animation: creditsExit 0.45s ease-in forwards;
}
@keyframes creditsEnter {
  from { transform: translateY(-104px); height: 104px; }
  to   { transform: translateY(0);      height: 100vh; height: 100dvh; }
}
@keyframes creditsExit {
  from { transform: translateY(0);      height: 100vh; height: 100dvh; }
  to   { transform: translateY(-104px); height: 104px; }
}
.credits-page__top,
.credits-page__bottom {
  position: relative;
  z-index: 2;
  height: 52px;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(0,0,0,1);
  background-size: auto 100%;
  background-repeat: repeat-x;
  display: flex;
  justify-content: space-between;
}
.credits-page__top  { background-position: center bottom; align-items: flex-start; }
.credits-page__bottom { background-position: center top; align-items: flex-end; }
.credits-page__bar-side {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-size: cover;
  background-repeat: no-repeat;
}
.credits-page__top .credits-page__bar-side:first-child {
  background-image: var(--corner-img-tl);
  background-position: top left;
  border-bottom-right-radius: 12px;
  box-shadow: 4px 4px 12px rgba(0,0,0,0.6);
}
.credits-page__top .credits-page__bar-side:last-child {
  background-image: var(--corner-img-tr);
  background-position: top right;
  border-bottom-left-radius: 12px;
  box-shadow: -4px 4px 12px rgba(0,0,0,0.6);
}
.credits-page__bottom .credits-page__bar-side:first-child {
  background-image: var(--corner-img-bl);
  background-position: bottom left;
  border-top-right-radius: 12px;
  box-shadow: 4px -4px 12px rgba(0,0,0,0.6);
}
.credits-page__bottom .credits-page__bar-side:last-child {
  background-image: var(--corner-img-br);
  background-position: bottom right;
  border-top-left-radius: 12px;
  box-shadow: -4px -4px 12px rgba(0,0,0,0.6);
}
.credits-page__top .credits-page__bar-centre {
  background-image: var(--corner-img-tm);
  background-size: cover;
  background-position: center top;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.6);
}
.credits-page__bottom .credits-page__bar-centre {
  background-image: var(--corner-img-bm);
  background-size: cover;
  background-position: center bottom;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  box-shadow: 0 -4px 12px rgba(0,0,0,0.6);
}
.credits-page__bar-centre {
  width: 60%;
  max-width: 840px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.credits-page__arrow {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  opacity: 1;
  transition: opacity 0.15s;
}
.credits-page__arrow:disabled {
  opacity: 0.25;
  cursor: default;
}
.credits-page__arrow img {
  width: 20px;
  height: 20px;
}
.credits-page__title {
  font-family: 'MedievalSharp', cursive;
  font-size: 24px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #e8d8b8;
}
.credits-page__close-bar-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.credits-page__close-bar-btn:hover { opacity: 1; }
.credits-page__close-bar-btn img {
  width: 20px;
  height: 20px;
}
.credits-page__close-bar-btn span {
  font-family: 'MedievalSharp', cursive;
  font-size: 13px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #e8d8b8;
}
.credits-page__middle {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
}
.credits-page__paper {
  width: 100%;
  max-width: 800px;
  height: fit-content;
  min-height: stretch;
  padding: 56px 9% 48px;
  box-sizing: border-box;
  background-image: url('pagescroll.png');
  background-size: 100% auto;
  background-repeat: repeat-y;
  background-position: center top;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
}
@media (min-width: 600px) {
  .credits-page__paper { font-size: 18px; line-height: 28px; }
}
@media (min-width: 1200px) {
  .credits-page__paper { padding: 56px 109px 48px; }
}
.credits-page h1 {
  font-size: clamp(22px, 5vw, 36px);
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 0 0 6px;
  text-decoration: none;
}
.credits-page h2 {
  font-size: clamp(16px, 3vw, 24px);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 28px 0 8px;
  text-decoration: none;
}
.credits-page p {
  margin: 0 0 16px;
}
.credits-page__names {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0 0 32px;
}
.credits-page__name {
  font-size: clamp(14px, 2.5vw, 20px);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
}
.credits-page__rule {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(60,28,0,0.35) 20%, rgba(60,28,0,0.35) 80%, transparent);
  margin: 20px 0 24px;
}
.credits-page__banner {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 20px;
  opacity: 0.9;
}
.credits-page__close-btn {
  display: block;
  margin: 8px auto 0;
  background: transparent;
  border: 1px solid rgba(60,28,0,0.4);
  color: #3d2008;
  font-family: 'MedievalSharp', serif;
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 28px;
  border-radius: 1px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.credits-page__close-btn:hover { background: rgba(60,28,0,0.12); border-color: rgba(60,28,0,0.6); }
.htp-illustration {
  width: 100%;
  background: rgba(60,28,0,0.06);
  border: 1px solid rgba(60,28,0,0.15);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(60,28,0,0.35);
  margin: 16px 0 24px;
  padding: 32px 0;
}
.htp-illustration--svg {
  background: transparent;
  border: none;
  padding: 8px 0;
}
.htp-illustration--svg svg {
  width: 100%;
  height: auto;
  display: block;
}
.htp-variants {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.htp-variant h3 {
  font-size: clamp(14px, 2.5vw, 20px);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 0 0 4px;
}
.htp-variant .htp-variant__tag {
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: rgba(60,28,0,0.5);
  margin: 0 0 10px;
  font-style: italic;
}
.settings-toggle {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.settings-toggle--on { background: rgba(200,160,40,0.7); }
.settings-toggle--off { background: rgba(255,255,255,0.15); }
.settings-toggle__knob {
  position: absolute;
  top: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.settings-toggle--on .settings-toggle__knob { left: 21px; }
.settings-toggle--off .settings-toggle__knob { left: 3px; }
.settings-cycler {
  display: flex;
  align-items: center;
  gap: 6px;
}
.settings-cycler__arrow {
  background: none;
  border: none;
  color: #c8b888;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  font-family: inherit;
  transition: color 0.15s;
}
.settings-cycler__arrow:hover { color: #e8d8b8; }
.settings-cycler__arrow:disabled { opacity: 0.2; cursor: default; }
.settings-cycler__value {
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #e8d8b8;
  min-width: 80px;
  text-align: center;
}
@media (min-width: 1024px) {
  .score-panel__inner {
    flex-direction: column !important;
    align-items: center;
    gap: 4px;
  }
  .score-panel-wrapper--defender {
    left: 6vw !important;
    right: auto !important;
    bottom: calc(50vh - 45px) !important;
  }
  .score-panel-wrapper--attacker {
    right: 6vw !important;
    left: auto !important;
    bottom: calc(50vh - 45px) !important;
  }
}
.winner-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: radial-gradient(ellipse at 50% 55%, #100c00 0%, #040308 50%, #000 100%);
  animation: sceneFadeIn 0.6s ease-out forwards;
  overflow: hidden;
}
.winner-overlay--defeat {
  background: radial-gradient(ellipse at 50% 85%, #3a0800 0%, #1c0300 35%, #0a0100 60%, #000 100%);
}
.winner-overlay__gold1 {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 62%, #7a5000 0%, #2a1800 42%, transparent 68%);
  animation: victoryPulse 3.2s ease-in-out infinite;
  pointer-events: none;
}
.winner-overlay__gold2 {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 56%, rgba(210,148,0,0.45) 0%, transparent 32%);
  animation: victoryPulse 2.1s ease-in-out infinite reverse;
  pointer-events: none;
}
.winner-overlay__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.winner-overlay__title {
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #c8b888;
  margin: 0;
}
.winner-overlay__name {
  font-size: clamp(28px, 6vw, 52px);
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #e8d8b8;
  margin: 0;
  text-shadow: 0 0 40px rgba(232,192,64,0.6);
}
.winner-overlay__name--defender { color: #e0d0b0; text-shadow: 0 0 50px rgba(232,210,160,0.7); }
.winner-overlay__name--attacker { color: #7ab0e8; text-shadow: 0 0 50px rgba(100,160,240,0.6); }
.winner-overlay__dismiss {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #6a5a3a;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  padding: 8px 16px;
  transition: color 0.2s;
  margin-top: -8px;
}
.winner-overlay__dismiss:hover { color: #a09070; }
.role-select-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: rgba(0,0,0,0.82);
  animation: sceneFadeIn 0.4s ease-out forwards;
}
.role-select__title {
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #c8b888;
  margin: 0;
}
.role-select__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(320px, calc(100vw - 48px));
}
.role-select__option {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 8px;
  color: #e8d8b8;
  padding: 16px 20px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font-family: inherit;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}
.role-select__option:hover { border-color: rgba(200,160,40,0.9); background: rgba(30,15,0,0.9); }
.role-select__option--selected { border-color: rgba(200,160,40,0.9); }
.role-select__option-icon { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.role-select__option-icon--2p { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 3px; flex-shrink: 0; }
.role-select__option-spacer { width: 36px; height: 36px; flex-shrink: 0; }
.role-select__option-text { display: flex; flex-direction: column; gap: 3px; flex: 1; align-items: center; text-align: center; }
.role-select__option-name { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
.role-select__option-desc { font-size: 11px; letter-spacing: 0.5px; color: #a09070; }
.find-match-modal__backdrop {
  position: fixed; inset: 0; z-index: 110;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
}
.find-match-modal {
  background: #1a0d03;
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 4px;
  padding: 24px 20px;
  width: 280px;
  display: flex; flex-direction: column; gap: 16px;
  font-family: 'MedievalSharp', cursive;
  color: #e8d8b8;
}
.find-match-modal__header {
  display: flex; align-items: center; justify-content: space-between;
}
.find-match-modal__title {
  font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #e8d8b8;
}
.find-match-modal__close {
  background: none; border: none; color: #a09070; font-size: 16px; cursor: pointer; padding: 0;
}
.find-match-modal__close:hover { color: #e8d8b8; }
.find-match-modal__player {
  text-align: center; font-size: 14px; color: #c8a060; letter-spacing: 1px;
}
.find-match-modal__settings {
  display: flex; flex-direction: column; gap: 10px;
}
.find-match-modal__setting {
  display: flex; align-items: center; justify-content: space-between;
}
.find-match-modal__setting label {
  font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #a09070;
}
.find-match-modal__cycler {
  display: flex; align-items: center; gap: 8px;
}
.find-match-modal__cycler button {
  background: none; border: none; color: #c8a060; font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1;
}
.find-match-modal__cycler button:disabled { opacity: 0.2; cursor: default; }
.find-match-modal__cycler span { font-size: 12px; color: #e8d8b8; min-width: 80px; text-align: center; }
.find-match-modal__find-btn {
  background: rgba(200,160,40,0.15); border: 1px solid rgba(200,160,40,0.5);
  color: #e8d8b8; font-family: 'MedievalSharp', cursive; font-size: 12px;
  letter-spacing: 2px; text-transform: uppercase; padding: 10px; cursor: pointer;
  border-radius: 2px;
}
.find-match-modal__find-btn:hover { background: rgba(200,160,40,0.25); }
.find-match-modal__cancel-btn {
  background: none; border: 1px solid rgba(200,160,40,0.3);
  color: #a09070; font-family: 'MedievalSharp', cursive; font-size: 11px;
  letter-spacing: 2px; text-transform: uppercase; padding: 8px 16px; cursor: pointer;
  border-radius: 2px; margin-top: 4px;
}
.find-match-modal__cancel-btn:hover { color: #e8d8b8; border-color: rgba(200,160,40,0.6); }
.find-match-modal__searching {
  display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 8px 0;
}
.find-match-modal__searching p { margin: 0; font-size: 12px; color: #c8a060; letter-spacing: 1px; }
.find-match-modal__spinner {
  width: 32px; height: 32px;
  border: 2px solid rgba(200,160,40,0.2);
  border-top-color: rgba(200,160,40,0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.find-match-modal__settings-summary { font-size: 10px !important; color: #706050 !important; letter-spacing: 0.5px !important; }
.find-match-modal__matched {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0;
  font-size: 12px; color: #c8a060; letter-spacing: 1px; text-align: center;
}
.find-match-modal__matched p { margin: 0; }
.find-match-modal__opponent strong { color: #e8d8b8; }
.find-match-modal__disconnected {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0;
  font-size: 12px; color: #c08060; letter-spacing: 1px; text-align: center;
}
.find-match-modal__disconnected p { margin: 0; }
.lobby-backdrop {
  position: fixed; inset: 0; z-index: 120;
  background: rgba(10,5,0,0.75); display: flex; align-items: center; justify-content: center;
}
.lobby-panel {
  background: rgba(20,10,2,0.97); border: 1px solid rgba(200,160,40,0.35); border-radius: 8px;
  padding: 20px; width: min(360px, calc(100vw - 32px)); display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.7);
}
.lobby-panel__header { display: flex; align-items: center; justify-content: space-between; }
.lobby-panel__title { font-family: 'MedievalSharp', cursive; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; color: #e8d8b8; }
.lobby-panel__close { background: none; border: none; cursor: pointer; color: #706050; font-size: 16px; padding: 4px 8px; transition: color 0.15s; }
.lobby-panel__close:hover { color: #e8d8b8; }
.lobby-panel__mine { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 8px 0; text-align: center; }
.lobby-panel__mine-label { margin: 0; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #706050; }
.lobby-panel__mine-detail { margin: 0; font-size: 12px; color: #c8a060; }
.lobby-panel__mine-detail strong { color: #e8d8b8; }
.lobby-panel__spinner {
  width: 24px; height: 24px; border: 2px solid rgba(200,160,40,0.2);
  border-top-color: rgba(200,160,40,0.8); border-radius: 50%; animation: spin 0.8s linear infinite;
}
.lobby-panel__waiting { margin: 0; font-size: 12px; color: #c8a060; letter-spacing: 1px; }
.lobby-panel__cancel-btn {
  background: none; border: 1px solid rgba(200,160,40,0.35); border-radius: 4px;
  color: #a08040; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase;
  padding: 6px 16px; cursor: pointer; transition: border-color 0.15s, color 0.15s; margin-top: 4px;
}
.lobby-panel__cancel-btn:hover { border-color: rgba(200,160,40,0.7); color: #e8d8b8; }
.lobby-panel__host-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; background: rgba(200,160,40,0.07); border-radius: 6px;
  border: 1px solid rgba(200,160,40,0.15);
}
.lobby-panel__host-summary { font-size: 11px; color: #c8a060; flex: 1; }
.lobby-panel__host-summary strong { color: #e8d8b8; }
.lobby-panel__host-btn {
  background: rgba(200,160,40,0.15); border: 1px solid rgba(200,160,40,0.5); border-radius: 4px;
  color: #e8d8b8; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
  padding: 6px 12px; cursor: pointer; white-space: nowrap; transition: background 0.15s;
}
.lobby-panel__host-btn:hover { background: rgba(200,160,40,0.28); }
.lobby-panel__list { display: flex; flex-direction: column; gap: 8px; }
.lobby-panel__challenge {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(200,160,40,0.15); border-radius: 6px;
}
.lobby-panel__challenge-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.lobby-panel__challenge-host { font-size: 13px; color: #e8d8b8; }
.lobby-panel__challenge-detail { font-size: 10px; color: #706050; letter-spacing: 0.5px; }
.lobby-panel__challenge-side { font-size: 11px; color: #c8a060; }
.lobby-panel__challenge-side strong { color: #e8d8b8; }
.lobby-panel__accept-btn {
  background: rgba(200,160,40,0.15); border: 1px solid rgba(200,160,40,0.5); border-radius: 4px;
  color: #e8d8b8; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
  padding: 6px 12px; cursor: pointer; transition: background 0.15s; white-space: nowrap;
}
.lobby-panel__accept-btn:hover:not(:disabled) { background: rgba(200,160,40,0.28); }
.lobby-panel__accept-btn:disabled { opacity: 0.3; cursor: default; }
.lobby-panel__empty { margin: 0; font-size: 11px; color: #504030; text-align: center; padding: 8px 0; letter-spacing: 0.5px; }
.challenge-invites {
  position: fixed; bottom: 20px; right: 16px; z-index: 105;
  display: flex; flex-direction: column; gap: 8px; max-width: 260px;
}
.challenge-invite {
  background: rgba(20,10,2,0.97); border: 1px solid rgba(200,160,40,0.4);
  border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.6); animation: invite-in 0.25s ease;
}
@keyframes invite-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.challenge-invite__label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #706050; margin: 0; }
.challenge-invite__host { font-size: 14px; color: #e8d8b8; margin: 0; }
.challenge-invite__detail { font-size: 10px; color: #706050; margin: 0; }
.challenge-invite__side { font-size: 11px; color: #c8a060; margin: 0; }
.challenge-invite__side strong { color: #e8d8b8; }
.challenge-invite__accept {
  margin-top: 2px; background: rgba(200,160,40,0.15); border: 1px solid rgba(200,160,40,0.5);
  border-radius: 4px; color: #e8d8b8; font-size: 11px; letter-spacing: 1.5px;
  text-transform: uppercase; padding: 6px 0; cursor: pointer; transition: background 0.15s; width: 100%;
}
.challenge-invite__accept:hover { background: rgba(200,160,40,0.28); }
.disconnect-banner {
  position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
  background: rgba(20,10,2,0.95); border: 1px solid rgba(200,100,40,0.5);
  border-radius: 6px; padding: 8px 16px; font-size: 11px; color: #c88040;
  letter-spacing: 1px; z-index: 110; white-space: nowrap;
}
.guest-login-modal__backdrop {
  position: fixed; inset: 0; z-index: 120;
  background: rgba(0,0,0,0.8);
  display: flex; align-items: center; justify-content: center;
}
.guest-login-modal {
  background: #1a0d03;
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 4px;
  padding: 24px 20px;
  width: 300px;
  display: flex; flex-direction: column; gap: 16px;
  font-family: 'MedievalSharp', cursive;
  color: #e8d8b8;
}
.guest-login-modal__header {
  display: flex; align-items: center; justify-content: space-between;
}
.guest-login-modal__title {
  font-size: 14px; letter-spacing: 3px; text-transform: uppercase; color: #e8d8b8;
}
.guest-login-modal__close {
  background: none; border: none; color: #a09070; font-size: 16px; cursor: pointer; padding: 0;
}
.guest-login-modal__close:hover { color: #e8d8b8; }
.guest-login-modal__body {
  margin: 0; font-size: 12px; color: #a09070; letter-spacing: 0.5px; line-height: 1.6;
  font-family: 'MedievalSharp', cursive;
}
.guest-login-modal__actions {
  display: flex; flex-direction: column; gap: 8px;
}
.guest-login-modal__btn {
  background: none; border: 1px solid rgba(200,160,40,0.3);
  color: #a09070; font-family: 'MedievalSharp', cursive; font-size: 11px;
  letter-spacing: 2px; text-transform: uppercase; padding: 10px 16px; cursor: pointer;
  border-radius: 2px;
}
.guest-login-modal__btn:hover { color: #e8d8b8; border-color: rgba(200,160,40,0.6); }
.guest-login-modal__btn--primary {
  background: rgba(200,160,40,0.15); border-color: rgba(200,160,40,0.5); color: #e8d8b8;
}
.guest-login-modal__btn--primary:hover { background: rgba(200,160,40,0.25); }
.match-header {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 16px;
  background: rgba(10,5,0,0.7);
  font-family: 'MedievalSharp', cursive;
  font-size: 11px; letter-spacing: 1px; color: #a09070;
  pointer-events: none;
}
.match-header__player { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.match-header__name { color: #e8d8b8; font-size: 12px; }
.match-header__side { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #706050; }
.match-header__turn { color: #c8a060; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; }
.match-header__player--active .match-header__name { color: #c8a060; }

.auth-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.75);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px;
  animation: sceneFadeIn 0.2s ease-out forwards;
}
.auth-modal {
  background: #0e0c09;
  border: 1px solid rgba(200,160,40,0.3);
  border-radius: 10px;
  padding: 20px;
  width: calc(100% - 48px); max-width: 340px;
  display: flex; flex-direction: column; gap: 10px;
  box-shadow: 0 8px 48px rgba(0,0,0,0.8);
  box-sizing: border-box;
}
.auth-modal__title { font-size: 18px; letter-spacing: 3px; text-transform: uppercase; color: #e8d8b8; text-align: center; margin-bottom: 4px; }
.auth-modal__subtitle { font-size: 12px; color: #a09070; text-align: center; letter-spacing: 0.5px; margin-bottom: 4px; }
.auth-modal__input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(200,160,40,0.2);
  border-radius: 6px;
  padding: 10px 14px;
  color: #e8d8b8;
  font-size: 13px;
  letter-spacing: 0.5px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}
.auth-modal__input:focus { border-color: rgba(200,160,40,0.6); }
.auth-modal__input::placeholder { color: rgba(200,180,140,0.3); }
.auth-modal__btn {
  border-radius: 6px; padding: 10px 16px; font-size: 12px;
  letter-spacing: 2px; text-transform: uppercase; cursor: pointer;
  border: none; font-family: inherit; transition: opacity 0.2s;
}
.auth-modal__btn:disabled { opacity: 0.5; cursor: default; }
.auth-modal__btn--primary {
  background: linear-gradient(135deg, #b8880a, #8a6008);
  color: #f5e8c0;
  margin-top: 4px;
}
.auth-modal__btn--primary:hover:not(:disabled) { opacity: 0.85; }
.auth-modal__btn--ghost {
  background: transparent; color: #a09070;
  border: 1px solid rgba(200,160,40,0.15);
}
.auth-modal__btn--ghost:hover { border-color: rgba(200,160,40,0.4); color: #c8a860; }
.auth-modal__cancel { flex-shrink: 0; }
.auth-modal__divider { text-align: center; font-size: 11px; color: rgba(200,180,140,0.3); letter-spacing: 1px; margin: 2px 0; }
.auth-modal__error { color: #d47060; font-size: 11px; letter-spacing: 0.5px; text-align: center; }
.auth-user-chip {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: rgba(200,160,40,0.08);
  border: 1px solid rgba(200,160,40,0.2);
  border-radius: 20px;
  font-size: 11px; letter-spacing: 1px; color: #c8a860;
}
.auth-user-chip__logout {
  background: none; border: none; cursor: pointer;
  color: rgba(200,160,40,0.4); font-size: 14px; line-height: 1;
  padding: 0; margin-left: 2px; font-family: inherit;
  transition: color 0.2s;
}
.auth-user-chip__logout:hover { color: #d47060; }
@keyframes mistDrift {
  0%   { transform: translateX(0px)   translateY(0px);  opacity: 0;    }
  15%  { opacity: var(--peak); }
  50%  { transform: translateX(var(--mx)) translateY(-18px); opacity: var(--peak); }
  85%  { opacity: var(--peak); }
  100% { transform: translateX(calc(var(--mx) * 2)) translateY(-30px); opacity: 0; }
}
`

function Mist({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(220,200,180,0.9) 0%, transparent 70%)',
        filter: 'blur(28px)',
        animation: 'mistDrift var(--dur) ease-in-out infinite',
        ...style,
      }}
    />
  )
}

const mists = Array.from({ length: 7 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  return {
    id: i,
    left: `${5 + (i / 7) * 90 + r(8)}%`,
    bottom: `${2 + Math.random() * 22}%`,
    width: `${180 + Math.random() * 200}px`,
    height: `${60 + Math.random() * 60}px`,
    dur: `${7 + Math.random() * 8}s`,
    delay: `${-Math.random() * 14}s`,
    mx: `${r(80)}px`,
    peak: `${0.12 + Math.random() * 0.1}`,
  }
})

function Ember({ style, variant }: { style: React.CSSProperties; variant: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 0.5,
        height: 14,
        borderRadius: 0,
        background: 'linear-gradient(to top, rgba(255,136,0,0.6), rgba(255,221,128,0.4))',
        boxShadow: '0 0 1px 0.5px rgba(255,120,0,0.3)',
        animationName: `ember${variant}`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        animationFillMode: 'both',
        ...style,
      }}
    />
  )
}

const embers = Array.from({ length: 12 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  const riseVal = -(280 + Math.random() * 320)
  const dx1Val = r(60), dx2Val = r(90), dx3Val = r(50)

  // Angle of travel at each waypoint (degrees from vertical)
  // Segment 0→30%: heading (dx1, rise*0.3)
  const a1 = Math.atan2(dx1Val, -riseVal * 0.3) * (180 / Math.PI)
  // Segment 30→60%: heading (dx2-dx1, rise*0.35)
  const a2 = Math.atan2(dx2Val - dx1Val, -riseVal * 0.35) * (180 / Math.PI)
  // Segment 60→100%: heading (dx3-dx2, rise*0.4)
  const a3 = Math.atan2(dx3Val - dx2Val, -riseVal * 0.4) * (180 / Math.PI)

  return {
    id: i,
    left: `${10 + (i / 12) * 80 + r(6)}%`,
    bottom: `${5 + Math.random() * 18}%`,
    dur: `${0.7 + Math.random() * 1.1}s`,
    delay: `${-Math.random() * 8}s`,
    rise: `${riseVal}px`,
    dx1: `${dx1Val}px`,
    dx2: `${dx2Val}px`,
    dx3: `${dx3Val}px`,
    a1: `${a1.toFixed(1)}deg`,
    a2: `${a2.toFixed(1)}deg`,
    a3: `${a3.toFixed(1)}deg`,
    variant: i % 3,
  }
})

function HintButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--hint" onClick={onClick}>
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/hint.svg`} alt="" />
      <span className="ui-button__label">Hint</span>
    </button>
  )
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--undo" onClick={onClick}>
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/undo.svg`} alt="" />
      <span className="ui-button__label">Undo</span>
    </button>
  )
}

function MenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button className="ui-button ui-button--menu" onClick={onClick}>
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/${isOpen ? 'close' : 'menu'}.svg`} alt="" />
      <span className="ui-button__label">{isOpen ? 'Close' : 'Menu'}</span>
    </button>
  )
}

function ProfileButton({ onClick, loggedIn }: { onClick: () => void; loggedIn: boolean }) {
  const base = import.meta.env.BASE_URL
  return (
    <button className="ui-button ui-button--profile" onClick={onClick} style={{ position: 'relative' }}>
      <img className="ui-button__icon" src={`${base}icons/${loggedIn ? 'profile' : 'login'}.svg`} alt="" />
      <span className="ui-button__label">{loggedIn ? 'You' : 'Log In'}</span>
      {loggedIn && <span className="ui-button__profile-dot" />}
    </button>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`settings-toggle settings-toggle--${on ? 'on' : 'off'}`} onClick={onClick}>
      <span className="settings-toggle__knob" />
    </button>
  )
}

function Cycler<T extends string>({ options, value, onChange, isDisabled }: {
  options: T[]
  value: T
  onChange: (v: T) => void
  isDisabled?: (v: T) => boolean
}) {
  const enabled = isDisabled ? options.filter(o => !isDisabled(o)) : options
  const ei = enabled.indexOf(value)
  const prev = () => { if (enabled.length > 0) onChange(enabled[(ei - 1 + enabled.length) % enabled.length]) }
  const next = () => { if (enabled.length > 0) onChange(enabled[(ei + 1) % enabled.length]) }
  const valueDisabled = isDisabled?.(value) ?? false
  return (
    <div className="settings-cycler">
      <button className="settings-cycler__arrow" onClick={prev} disabled={enabled.length <= 1}>&#8249;</button>
      <span className="settings-cycler__value" style={{ opacity: valueDisabled ? 0.35 : 1 }}>{value}</span>
      <button className="settings-cycler__arrow" onClick={next} disabled={enabled.length <= 1}>&#8250;</button>
    </div>
  )
}

const BOARD_SIZE_RULES: Record<number, Rules[]> = {
  7:  ['Brandub', 'Ard Rí'],
  9:  ['Linnaeus Tablut', 'Saami Tablut'],
  11: ['Copenhagen', 'Fetlar', 'Historical', 'Tawlbwrdd', 'Simple Tyr'],
  13: ['Copenhagen', 'Fetlar', 'Historical'],
  15: ['Tyr'],
  17: [],
  19: ['Alea Evangelii'],
}

const ALL_RULES: Rules[] = ['Copenhagen', 'Fetlar', 'Historical', 'Tawlbwrdd', 'Simple Tyr', 'Linnaeus Tablut', 'Saami Tablut', 'Brandub', 'Ard Rí', 'Tyr', 'Alea Evangelii']
const ALL_BOARD_SIZES = [7, 9, 11, 13, 15, 17, 19].filter(n => (BOARD_SIZE_RULES[n] ?? []).length > 0)


function ScrollPage({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [closing, setClosing] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)
  const middleRef = useRef<HTMLDivElement>(null)
  const base = import.meta.env.BASE_URL

  const handleClose = () => { setClosing(true); setTimeout(onClose, 450) }

  const checkScroll = () => {
    const el = middleRef.current
    if (!el) return
    setAtTop(el.scrollTop <= 1)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }

  useEffect(() => {
    const el = middleRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    middleRef.current?.scrollBy({ top: dir * 300, behavior: 'smooth' })
  }

  const Bars = ({ position }: { position: 'top' | 'bottom' }) => (
    <div
      className={`credits-page__${position}`}
      style={{ backgroundImage: `url(${base}${position === 'top' ? 'wood-top' : 'wood-bottom'}.jpg)` }}
    >
      <div className="credits-page__bar-side">
        {position === 'top'
          ? <button className="credits-page__arrow" onClick={() => scrollBy(-1)} disabled={atTop}><img src={`${base}icons/arrow-up.svg`} alt="" /></button>
          : <button className="credits-page__arrow" onClick={() => scrollBy(1)} disabled={atBottom}><img src={`${base}icons/arrow-down.svg`} alt="" /></button>
        }
      </div>
      <div className="credits-page__bar-centre">
        {position === 'top'
          ? <span className="credits-page__title">{title}</span>
          : <button className="credits-page__close-bar-btn" onClick={handleClose}><img src={`${base}icons/close.svg`} alt="" /><span>Close</span></button>
        }
      </div>
      <div className="credits-page__bar-side">
        {position === 'top'
          ? <button className="credits-page__arrow" onClick={() => scrollBy(-1)} disabled={atTop}><img src={`${base}icons/arrow-up.svg`} alt="" /></button>
          : <button className="credits-page__arrow" onClick={() => scrollBy(1)} disabled={atBottom}><img src={`${base}icons/arrow-down.svg`} alt="" /></button>
        }
      </div>
    </div>
  )

  const cornerStyle = {
    '--corner-img-tl': `url(${base}wood-top-left.jpg)`,
    '--corner-img-tr': `url(${base}wood-top-right.jpg)`,
    '--corner-img-tm': `url(${base}wood-top-middle.jpg)`,
    '--corner-img-bl': `url(${base}wood-bottom-left.jpg)`,
    '--corner-img-br': `url(${base}wood-bottom-right.jpg)`,
    '--corner-img-bm': `url(${base}wood-bottom-middle.jpg)`,
  } as React.CSSProperties

  return (
    <div className={`credits-page${closing ? ' credits-page--closing' : ''}`} style={cornerStyle}>
      <Bars position="top" />
      <div className="credits-page__middle" ref={middleRef}>
        <div className="credits-page__paper" style={{ backgroundImage: `url(${base}pagescroll.png)` }}>
          {children}
        </div>
      </div>
      <Bars position="bottom" />
    </div>
  )
}

function CreditsScroll({ onClose }: { onClose: () => void }) {
  const base = import.meta.env.BASE_URL
  return (
    <ScrollPage title="Credits" onClose={onClose}>
      <img src={`${base}credits-banner.jpg`} alt="" className="credits-page__banner" />
      <p>
        High Kings was forged around 2010 by three friends who wanted to bring one of history's forgotten strategy games back to life.
        Hnefatafl was the chess of the Norse world — a game of kings and raiders played across northern Europe for hundreds of years,
        before chess arrived from the south and slowly pushed it into obscurity.
      </p>
      <p>
        This site is built in Three.js and React, running entirely in your browser. The board and pieces are rendered in real-time 3D,
        and the AI opponent uses a minimax search with alpha-beta pruning — it will not go easy on you.
      </p>
      <p>
        Online play is powered by Supabase. All eleven variants are faithful to their historical sources where records survive, and to the
        best available reconstructions where they don't.
      </p>
      <hr className="credits-page__rule" />
      <div className="credits-page__names">
        <span className="credits-page__name">Jason Frame</span>
        <span className="credits-page__name">Lewis MacKenzie</span>
        <span className="credits-page__name">Andrew Nicolson</span>
      </div>
    </ScrollPage>
  )
}

type StatRow = { opponent_type: string; result: string; rules: string; board_size: number; count: number }

function ProfileScroll({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSaving, setNameSaving] = useState(false)
  const [stats, setStats] = useState<StatRow[]>([])
  const { userId, username, elo, setAuth, setUsername } = useGameStore()

  useEffect(() => {
    if (!userId) return
    supabase
      .from('game_results')
      .select('opponent_type, result, rules, board_size')
      .eq('user_id', userId)
      .then(({ data, error }) => {
        if (error) { console.error('game_results select:', error.message); return }
        if (!data) return
        const grouped = new Map<string, StatRow>()
        for (const row of data) {
          const key = `${row.rules}|${row.board_size}|${row.opponent_type}|${row.result}`
          const existing = grouped.get(key)
          if (existing) existing.count++
          else grouped.set(key, { ...row, count: 1 })
        }
        setStats([...grouped.values()])
      })
  }, [userId])
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuth(null, null)
    onClose()
  }
  const handleStartEdit = () => { setNameInput(username ?? ''); setNameError(null); setEditingName(true) }
  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed.length < 3) { setNameError('Must be at least 3 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setNameError('Letters, numbers and underscores only'); return }
    setNameSaving(true); setNameError(null)
    const { error } = await supabase.from('profiles').upsert({ id: userId, username: trimmed })
    if (error) {
      setNameError(error.message.includes('unique') ? 'That name is taken' : error.message)
      setNameSaving(false); return
    }
    setUsername(trimmed)
    setNameSaving(false)
    setEditingName(false)
  }
  return (
    <ScrollPage title="Profile" onClose={onClose}>
      {userId ? (
        <>
          {editingName ? (
            <div className="profile-scroll__edit-name">
              <input
                className="auth-modal__input profile-scroll__name-input"
                type="text"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                maxLength={20}
                autoFocus
              />
              {nameError && <p className="auth-modal__error">{nameError}</p>}
              <div className="profile-scroll__name-actions">
                <button className="credits-page__close-btn" onClick={handleSaveName} disabled={nameSaving}>
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
                <button className="credits-page__close-btn" onClick={() => setEditingName(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-scroll__name-row">
                <span className="profile-scroll__name">{username ?? 'Anonymous'}</span>
                <button className="profile-scroll__edit-btn" onClick={handleStartEdit}>Edit</button>
              </div>
              {elo !== null && (
                <div className="profile-scroll__elo">
                  <span className="profile-scroll__elo-label">ELO</span>
                  <span className="profile-scroll__elo-value">{elo}</span>
                </div>
              )}
            </>
          )}
          <hr className="credits-page__rule" />
          {(() => {
            const totalW = stats.filter(s => s.result === 'win').reduce((a, s) => a + s.count, 0)
            const totalL = stats.filter(s => s.result === 'loss').reduce((a, s) => a + s.count, 0)
            const total = totalW + totalL
            const rate = total > 0 ? Math.round((totalW / total) * 100) : null
            if (total === 0) return null
            return (
              <div className="profile-scroll__summary">
                <span className="profile-scroll__summary-wins">{totalW}W</span>
                <span className="profile-scroll__summary-sep">/</span>
                <span className="profile-scroll__summary-losses">{totalL}L</span>
                {rate !== null && <span className="profile-scroll__summary-rate">{rate}% win rate</span>}
              </div>
            )
          })()}
          <h2>Stats by Variant</h2>
          {(() => {
            const variants = [...new Map(stats.map(s => [`${s.rules}|${s.board_size}`, { rules: s.rules, board_size: s.board_size }])).values()]
              .sort((a, b) => a.rules.localeCompare(b.rules) || a.board_size - b.board_size)
            if (variants.length === 0) return (
              <p style={{ color: '#7a5228', fontStyle: 'italic', fontSize: '0.85em' }}>No games recorded yet.</p>
            )
            return variants.map(({ rules: v, board_size: bs }) => (
              <div key={`${v}|${bs}`} className="profile-scroll__stat-block">
                <div className="profile-scroll__stat-label">{v} — {bs}×{bs}</div>
                {(['machine', 'human'] as const).map(type => {
                  const w = stats.find(s => s.rules === v && s.board_size === bs && s.opponent_type === type && s.result === 'win')?.count ?? 0
                  const l = stats.find(s => s.rules === v && s.board_size === bs && s.opponent_type === type && s.result === 'loss')?.count ?? 0
                  if (w === 0 && l === 0) return null
                  return (
                    <div key={type} className="profile-scroll__stat-row">
                      <span className="profile-scroll__stat-type">{type === 'machine' ? 'vs Machine' : 'vs Players'}</span>
                      <span className="profile-scroll__stat-win">{w}W</span>
                      <span className="profile-scroll__stat-sep">/</span>
                      <span className="profile-scroll__stat-loss">{l}L</span>
                    </div>
                  )
                })}
              </div>
            ))
          })()}
          <button className="credits-page__close-btn" onClick={handleSignOut}>Log Out</button>
        </>
      ) : (
        <>
          <p>Log in to track your wins, losses and rank on the leaderboard.</p>
          <button className="credits-page__close-btn" onClick={onSignIn}>Log In / Register</button>
        </>
      )}
    </ScrollPage>
  )
}

// Reusable piece shapes -------------------------------------------------------
const ATK = '#3d1e0a'    // dark brown attacker fill
const DEF = '#7a5228'    // darker tan defender (contrasts parchment)
const KING_FILL = '#8c6518' // deep gold king fill
const KING_C = '#c8a96e'  // gold accent colour
const GRID = 'rgba(60,28,0,0.22)'
const SPECIAL = 'rgba(200,169,110,0.35)'

function Piece({ cx, cy, r = 10, type = 'atk' }: { cx: number; cy: number; r?: number; type?: 'atk' | 'def' | 'king' }) {
  const fill = type === 'atk' ? ATK : type === 'king' ? KING_FILL : DEF
  const strokeC = type === 'atk' ? '#1a0a02' : type === 'king' ? '#4a3008' : '#3a2010'
  const kr = type === 'king' ? r * 1.2 : r
  return (
    <g>
      <ellipse cx={cx} cy={cy + kr * 0.2} rx={kr * 0.9} ry={kr * 0.22} fill="rgba(0,0,0,0.22)" />
      <circle cx={cx} cy={cy} r={kr} fill={fill} stroke={strokeC} strokeWidth={1.5} />
      <ellipse cx={cx - kr * 0.28} cy={cy - kr * 0.3} rx={kr * 0.2} ry={kr * 0.14} fill="rgba(255,255,255,0.28)" />
      {type === 'king' && <>
        <line x1={cx} y1={cy - kr * 0.8} x2={cx} y2={cy - kr * 0.45} stroke={KING_C} strokeWidth={2} strokeLinecap="round"/>
        <circle cx={cx} cy={cy - kr * 0.8} r={kr * 0.15} fill={KING_C}/>
      </>}
    </g>
  )
}

function Grid({ cols, rows, size, ox = 0, oy = 0, specials = [] as [number,number][], throne = false }: {
  cols: number; rows: number; size: number; ox?: number; oy?: number; specials?: [number,number][]; throne?: boolean
}) {
  const corners: [number,number][] = [[0,0],[0,cols-1],[rows-1,0],[rows-1,cols-1]]
  return (
    <g>
      {Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
        const isCorner = corners.some(([cr,cc])=>cr===r&&cc===c)
        const isThrone = throne && r === Math.floor(rows/2) && c === Math.floor(cols/2)
        const isSpecial = specials.some(([sr,sc])=>sr===r&&sc===c)
        const fill = (isCorner||isThrone||isSpecial) ? SPECIAL : 'rgba(60,28,0,0.04)'
        const stroke = (isCorner||isThrone||isSpecial) ? KING_C : GRID
        const sw = (isCorner||isThrone||isSpecial) ? 1.5 : 0.7
        return <rect key={`${r}-${c}`} x={ox+c*size} y={oy+r*size} width={size-1} height={size-1} fill={fill} stroke={stroke} strokeWidth={sw} rx={(isCorner||isThrone)?2:0}/>
      }))}
    </g>
  )
}

function Illustration({ label }: { label: string }) {
  const svgs: Record<string, React.ReactNode> = {
    'intro-map': (
      <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes im-route { 0%{stroke-dashoffset:320;opacity:0} 15%{opacity:1} 80%{stroke-dashoffset:0;opacity:1} 100%{stroke-dashoffset:0;opacity:0} }
          @keyframes im-ship  { 0%{transform:translate(0,0)} 80%{transform:translate(68px,-30px)} 100%{transform:translate(68px,-30px)} }
          @keyframes im-dot   { 0%,100%{opacity:0.35} 50%{opacity:1} }
          @keyframes im-ring  { 0%{r:6;opacity:0.7} 100%{r:18;opacity:0} }
          .im-r1{stroke-dasharray:320;animation:im-route 5s ease-in-out infinite;}
          .im-r2{stroke-dasharray:260;animation:im-route 5s ease-in-out infinite;animation-delay:1.8s;}
          .im-r3{stroke-dasharray:180;animation:im-route 5s ease-in-out infinite;animation-delay:3.2s;}
          .im-ship{animation:im-ship 5s ease-in-out infinite;}
          .im-dot{animation:im-dot 3s ease-in-out infinite;}
          .im-ring{animation:im-ring 2s ease-out infinite;fill:none;stroke:#c8a96e;stroke-width:1.2;}
        `}</style>
        {/* Scandinavia */}
        <path d="M190 40 Q205 28 225 38 Q245 28 258 50 Q270 75 255 100 Q268 122 252 145 Q235 168 215 158 Q198 174 182 158 Q162 142 167 118 Q148 100 162 78 Q145 55 190 40Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Britain */}
        <path d="M70 95 Q88 75 106 88 Q118 108 112 132 Q100 150 84 144 Q65 132 70 95Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Ireland */}
        <path d="M45 115 Q58 100 68 118 Q64 138 48 138 Q35 130 45 115Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Sea routes */}
        <path className="im-r1" d="M88 115 C130 80 165 85 180 105" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <path className="im-r2" d="M180 105 C225 90 255 100 270 120" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <path className="im-r3" d="M88 115 C100 148 132 165 162 162" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        {/* Moving longship */}
        <g className="im-ship" style={{transformOrigin:'88px 115px'}}>
          <ellipse cx="88" cy="115" rx="8" ry="4" fill={ATK} opacity="0.9"/>
          <line x1="88" y1="111" x2="88" y2="102" stroke={KING_C} strokeWidth="1.5"/>
          <path d="M88 102 L97 107 L88 110Z" fill={KING_C} opacity="0.9"/>
        </g>
        {/* Location dots with ring pulse */}
        {([
          [88,115,0],[182,105,0.9],[162,162,1.8],[270,120,2.7],[50,115,3.6]
        ] as [number,number,number][]).map(([x,y,d],i)=>(
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill={KING_C} className="im-dot" style={{animationDelay:`${d}s`}}/>
            <circle cx={x} cy={y} r="5" fill="none" stroke={KING_C} strokeWidth="1.5" className="im-ring" style={{animationDelay:`${d}s`}}/>
          </g>
        ))}
        <text x="200" y="192" fill={KING_C} fontSize="10" fontFamily="MedievalSharp,cursive" opacity="0.6" textAnchor="middle">Northern Europe  ·  400–1400 AD</text>
      </svg>
    ),
    'board-overview': (
      <svg viewBox="0 0 260 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes bo-c{0%,100%{opacity:0.45}50%{opacity:1}}
          .bo-c1{animation:bo-c 3s ease-in-out infinite;}
          .bo-c2{animation:bo-c 3s ease-in-out .75s infinite;}
          .bo-c3{animation:bo-c 3s ease-in-out 1.5s infinite;}
          .bo-c4{animation:bo-c 3s ease-in-out 2.25s infinite;}
          @keyframes bo-t{0%,100%{opacity:0.5}50%{opacity:1}}
          .bo-throne{animation:bo-t 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={7} rows={7} size={30} ox={20} oy={20} throne/>
        <rect className="bo-c1" x={21} y={21} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c2" x={21+6*30} y={21} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c3" x={21} y={21+6*30} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c4" x={21+6*30} y={21+6*30} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-throne" x={21+3*30} y={21+3*30} width={28} height={28} fill="rgba(200,169,110,0.18)" stroke={KING_C} strokeWidth={1.5} rx={3}/>
        <Piece cx={20+3*30+14} cy={20+3*30+14} r={7} type="king"/>
        <text x="35" y="14" textAnchor="middle" fill={KING_C} fontSize="8.5" fontFamily="MedievalSharp,cursive">escape</text>
        <line x1="35" y1="16" x2="35" y2="21" stroke={KING_C} strokeWidth="1" opacity="0.5"/>
        <text x="130" y="240" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Throne · Corners are escape squares</text>
      </svg>
    ),
    'two-sides': (
      <svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ts-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          .ts-a{animation:ts-bob 2.8s ease-in-out infinite;}
          .ts-d{animation:ts-bob 2.8s ease-in-out 1.4s infinite;}
        `}</style>
        <g className="ts-a">
          <text x="80" y="20" textAnchor="middle" fill={KING_C} fontSize="12" fontFamily="MedievalSharp,cursive" letterSpacing="2">ATTACKERS</text>
          <Piece cx={26} cy={75} r={11} type="atk"/>
          <Piece cx={52} cy={75} r={11} type="atk"/>
          <Piece cx={78} cy={75} r={11} type="atk"/>
          <Piece cx={104} cy={75} r={11} type="atk"/>
          <Piece cx={130} cy={75} r={11} type="atk"/>
          <Piece cx={39} cy={105} r={11} type="atk"/>
          <Piece cx={65} cy={105} r={11} type="atk"/>
          <Piece cx={91} cy={105} r={11} type="atk"/>
          <text x="80" y="142" textAnchor="middle" fill="rgba(60,28,0,0.55)" fontSize="10" fontFamily="MedievalSharp,cursive">More pieces · Surround</text>
        </g>
        <text x="190" y="95" textAnchor="middle" fill={KING_C} fontSize="22" fontFamily="MedievalSharp,cursive">vs</text>
        <g className="ts-d">
          <text x="300" y="20" textAnchor="middle" fill={KING_C} fontSize="12" fontFamily="MedievalSharp,cursive" letterSpacing="2">DEFENDERS</text>
          <Piece cx={248} cy={75} r={11} type="def"/>
          <Piece cx={274} cy={75} r={11} type="def"/>
          <Piece cx={300} cy={75} r={11} type="def"/>
          <Piece cx={326} cy={75} r={11} type="def"/>
          <Piece cx={274} cy={105} r={11} type="def"/>
          <Piece cx={300} cy={105} r={13} type="king"/>
          <Piece cx={326} cy={105} r={11} type="def"/>
          <text x="300" y="142" textAnchor="middle" fill="rgba(60,28,0,0.55)" fontSize="10" fontFamily="MedievalSharp,cursive">Fewer · Escort the King</text>
        </g>
      </svg>
    ),
    'movement': (
      <svg viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes mv-slide{0%,15%{transform:translateX(0)}70%,100%{transform:translateX(230px)}}
          @keyframes mv-trail{0%,10%{stroke-dashoffset:230;opacity:0}30%{opacity:0.7}70%{stroke-dashoffset:0;opacity:0.7}85%,100%{opacity:0}}
          @keyframes mv-dest{0%,65%{opacity:0}80%,100%{opacity:1}}
          .mv-piece{animation:mv-slide 3.5s ease-in-out infinite;transform-box:fill-box;}
          .mv-trail{stroke-dasharray:230;animation:mv-trail 3.5s ease-in-out infinite;}
          .mv-dest{animation:mv-dest 3.5s ease-in-out infinite;}
        `}</style>
        {[0,1,2,3,4,5,6].map(c=>(
          <rect key={c} x={10+c*46} y={50} width={45} height={45}
            fill={c===5?'rgba(200,169,110,0.18)':'rgba(60,28,0,0.04)'}
            stroke={c===5?KING_C:GRID} strokeWidth={c===5?1.5:0.8} rx={c===5?2:0}/>
        ))}
        <line className="mv-trail" x1="32" y1="72" x2="262" y2="72" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <g className="mv-dest">
          <rect x={241} y={51} width={43} height={43} fill="rgba(200,169,110,0.2)" stroke={KING_C} strokeWidth="1.5" strokeDasharray="4 2" rx={2}/>
        </g>
        <g className="mv-piece">
          <Piece cx={32} cy={72} r={11} type="atk"/>
        </g>
        <text x="170" y="130" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Any distance · Straight lines · No jumping</text>
      </svg>
    ),
    'capture': (
      <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes cap-move{0%,10%{transform:translateX(0)}60%,100%{transform:translateX(56px)}}
          @keyframes cap-fade{0%,55%{opacity:1;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.4)}}
          @keyframes cap-flash{0%,58%{opacity:0;transform:scale(0.5)}72%{opacity:1;transform:scale(1)}90%,100%{opacity:0;transform:scale(1.4)}}
          .cap-mover{animation:cap-move 4s ease-in-out infinite;transform-box:fill-box;}
          .cap-victim{animation:cap-fade 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .cap-burst{animation:cap-flash 4s ease-in-out infinite;transform-box:fill-box;}
        `}</style>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} x={10+c*56} y={60} width={55} height={55} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <g className="cap-mover"><Piece cx={37} cy={87} r={13} type="atk"/></g>
        <g className="cap-victim"><Piece cx={150} cy={87} r={13} type="def"/></g>
        <Piece cx={206} cy={87} r={13} type="atk"/>
        <g className="cap-burst" style={{transformOrigin:'150px 87px'}}>
          {[0,45,90,135,180,225,270,315].map((a,i)=>(
            <line key={i}
              x1={150+Math.cos(a*Math.PI/180)*15} y1={87+Math.sin(a*Math.PI/180)*15}
              x2={150+Math.cos(a*Math.PI/180)*24} y2={87+Math.sin(a*Math.PI/180)*24}
              stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
          ))}
          <circle cx="150" cy="87" r="11" fill="rgba(200,169,110,0.35)" stroke={KING_C} strokeWidth="1.5"/>
        </g>
        <text x="150" y="148" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Sandwich between two of your own</text>
      </svg>
    ),
    'hostile-squares': (
      <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes hs-glow{0%,100%{opacity:0.45}50%{opacity:1}}
          @keyframes hs-fade{0%,60%{opacity:1;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.4)}}
          .hs-sq{animation:hs-glow 2.5s ease-in-out infinite;}
          .hs-vic{animation:hs-fade 3.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        {/* 4-cell row */}
        {[0,1,2,3].map(c=>(
          <rect key={c} x={10+c*70} y={55} width={69} height={69} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        {/* Left = empty corner acting as captor */}
        <rect className="hs-sq" x={11} y={56} width={67} height={67} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <text x="45" y="88" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">Corner</text>
        {/* Victim (defender) in cell 1 */}
        <g className="hs-vic"><Piece cx={115} cy={89} r={15} type="def"/></g>
        {/* Cell 2 = attacker */}
        <Piece cx={185} cy={89} r={15} type="atk"/>
        {/* Cell 3 = empty throne */}
        <rect x={221} y={56} width={67} height={67} fill="rgba(200,169,110,0.2)" stroke={KING_C} strokeWidth="1.5" strokeDasharray="4 2" rx={3}/>
        <text x="255" y="88" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">Throne</text>
        {/* Ring burst */}
        <text x="150" y="168" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Empty corner or Throne counts as captor</text>
      </svg>
    ),
    'king-capture': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes kc-mover{0%,5%{transform:translateX(-110px)}50%,100%{transform:translateX(0)}}
          @keyframes kc-king{0%,55%{opacity:1;transform:scale(1)}75%,100%{opacity:0;transform:scale(1.4)}}
          .kc-mover{animation:kc-mover 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .kc-king{animation:kc-king 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20} throne/>
        <Piece cx={120} cy={80}  r={11} type="atk"/>
        <Piece cx={120} cy={160} r={11} type="atk"/>
        <Piece cx={160} cy={120} r={11} type="atk"/>
        <g className="kc-mover"><Piece cx={80} cy={120} r={11} type="atk"/></g>
        <g className="kc-king"><Piece cx={120} cy={120} r={12} type="king"/></g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Final attacker seals all four sides</text>
      </svg>
    ),
    'king-escape': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ke-go{0%,10%{transform:translateX(0)}65%,100%{transform:translateX(-80px)}}
          @keyframes ke-trail{0%,8%{stroke-dashoffset:80;opacity:0}20%{opacity:0.85}62%{stroke-dashoffset:0;opacity:0.85}75%,100%{opacity:0}}
          @keyframes ke-burst{0%,65%{opacity:0;r:6}75%{opacity:1;r:18}90%,100%{opacity:0;r:26}}
          @keyframes ke-corner{0%,100%{opacity:0.4}50%{opacity:1}}
          .ke-king{animation:ke-go 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .ke-trail{stroke-dasharray:80;animation:ke-trail 4s ease-in-out infinite;}
          .ke-burst{animation:ke-burst 4s ease-in-out infinite;}
          .ke-corner{animation:ke-corner 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20}/>
        <rect className="ke-corner" x={21} y={181} width={38} height={38} fill={SPECIAL} stroke={KING_C} strokeWidth={2.5} rx={4}/>
        <text x="40" y="177" textAnchor="middle" fill={KING_C} fontSize="8" fontFamily="MedievalSharp,cursive">escape</text>
        <line className="ke-trail" x1="120" y1="200" x2="40" y2="200" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 4"/>
        <circle className="ke-burst" cx="40" cy="200" fill="none" stroke={KING_C} strokeWidth="1.5"/>
        <g className="ke-king" style={{transformOrigin:'120px 200px'}}>
          <Piece cx={120} cy={200} r={13} type="king"/>
        </g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">King at a corner · Defenders win</text>
      </svg>
    ),
    'shieldwall': (
      <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes sw-in{0%,5%{transform:translateX(-90px)}50%,100%{transform:translateX(0)}}
          @keyframes sw-die{0%,52%{opacity:1;transform:scale(1)}74%{opacity:0;transform:scale(1.4)}88%,100%{opacity:0;transform:scale(1.4)}}
          .sw-mover{animation:sw-in 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d1{animation:sw-die 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d2{animation:sw-die 3s ease-in-out .07s infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d3{animation:sw-die 3s ease-in-out .14s infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        <rect x={20} y={25} width={280} height={10} fill={ATK} opacity="0.35" rx="2"/>
        <text x="160" y="20" textAnchor="middle" fill="rgba(60,28,0,0.4)" fontSize="8" fontFamily="MedievalSharp,cursive">Board edge</text>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} x={20+c*56} y={35} width={55} height={55} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <g className="sw-d1"><Piece cx={104} cy={62} r={14} type="def"/></g>
        <g className="sw-d2"><Piece cx={160} cy={62} r={14} type="def"/></g>
        <g className="sw-d3"><Piece cx={216} cy={62} r={14} type="def"/></g>
        <g className="sw-mover"><Piece cx={48} cy={62} r={14} type="atk"/></g>
        <Piece cx={272} cy={62} r={14} type="atk"/>
        <text x="160" y="160" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Flank both ends · Whole line wiped</text>
      </svg>
    ),
    'edge-escape': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ee-edge{0%,100%{opacity:0.35}50%{opacity:0.85}}
          @keyframes ee-king{0%,10%{transform:translateY(0)}65%,100%{transform:translateY(-80px)}}
          @keyframes ee-burst{0%,63%{opacity:0;r:8}77%{opacity:1;r:18}90%,100%{opacity:0;r:24}}
          .ee-edge{animation:ee-edge 2s ease-in-out infinite;}
          .ee-king{animation:ee-king 3.5s ease-in-out infinite;transform-box:fill-box;}
          .ee-burst{animation:ee-burst 3.5s ease-in-out infinite;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20}/>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} className="ee-edge" x={21+c*40} y={21} width={38} height={38} fill={SPECIAL} stroke={KING_C} strokeWidth={1.5} rx={2}/>
        ))}
        <text x="120" y="15" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">any edge square</text>
        <circle className="ee-burst" cx="120" cy="40" fill="none" stroke={KING_C} strokeWidth="1.5"/>
        <g className="ee-king" style={{transformOrigin:'120px 120px'}}>
          <Piece cx={120} cy={120} r={13} type="king"/>
        </g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Tawlbwrdd · Reach any edge to win</text>
      </svg>
    ),
    'weak-king': (
      <svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes wk-in{0%,5%{transform:translateX(80px)}50%,100%{transform:translateX(0)}}
          @keyframes wk-die{0%,50%{opacity:1;transform:scale(1)}75%,100%{opacity:0;transform:scale(1.4)}}
          .wk-in{animation:wk-in 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .wk-king{animation:wk-die 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        {[0,1,2].map(c=>(
          <rect key={c} x={60+c*60} y={55} width={59} height={59} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <Piece cx={89} cy={84} r={14} type="atk"/>
        <g className="wk-king" style={{transformOrigin:'150px 84px'}}><Piece cx={150} cy={84} r={14} type="king"/></g>
        <g className="wk-in"><Piece cx={211} cy={84} r={14} type="atk"/></g>
        <text x="150" y="148" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Weak king — sandwiched like any other piece</text>
      </svg>
    ),
    'saami-start': (() => {
      const S = 22, OX = 2, OY = 2
      const defs: [number,number][] = [[3,4],[5,4],[4,3],[4,5],[2,4],[6,4],[4,2],[4,6]]
      const atks: [number,number][] = [[0,3],[0,4],[0,5],[3,0],[4,0],[5,0],[8,3],[8,4],[8,5],[3,8],[4,8],[5,8]]
      return (
        <svg viewBox="0 0 202 220" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={9} rows={9} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={6} type="atk"/>)}
          <Piece cx={OX+4*S+S/2} cy={OY+4*S+S/2} r={8} type="king"/>
          <text x="101" y="210" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">9 defenders · 16 attackers</text>
        </svg>
      )
    })(),
    'brandub-board': (() => {
      const S = 26, OX = 4, OY = 4
      const defs: [number,number][] = [[2,3],[4,3],[3,2],[3,4]]
      const atks: [number,number][] = [[0,3],[3,0],[6,3],[3,6],[1,3],[3,1],[5,3],[3,5]]
      return (
        <svg viewBox="0 0 196 210" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={7} rows={7} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={8} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="atk"/>)}
          <Piece cx={OX+3*S+S/2} cy={OY+3*S+S/2} r={9} type="king"/>
          <text x="98" y="199" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">4 defenders · 8 attackers</text>
        </svg>
      )
    })(),
    'ard-ri-board': (() => {
      const S = 26, OX = 4, OY = 4
      const defs: [number,number][] = [[2,3],[4,3],[3,2],[3,4],[1,3],[5,3],[3,1],[3,5]]
      const atks: [number,number][] = [[0,2],[0,3],[0,4],[2,0],[3,0],[4,0],[6,2],[6,3],[6,4],[2,6],[3,6],[4,6]]
      return (
        <svg viewBox="0 0 196 210" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={7} rows={7} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={6} type="atk"/>)}
          <Piece cx={OX+3*S+S/2} cy={OY+3*S+S/2} r={9} type="king"/>
          <text x="98" y="199" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">8 defenders · 12 attackers</text>
        </svg>
      )
    })(),
    'alea-board': (() => {
      const s = 9, ox = 34, oy = 14
      const pc = (r: number, c: number) => ({ cx: ox + c*s + s/2, cy: oy + r*s + s/2 })
      return (
      <svg viewBox="0 0 240 224" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes al-glow{0%,100%{opacity:0.4}50%{opacity:1}}
          .al-king{animation:al-glow 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={19} rows={19} size={s} ox={ox} oy={oy}/>
        {([[5,9],[9,5],[9,13],[13,9],[4,9],[9,4],[9,14],[14,9],[6,7],[6,11],[7,6],[7,12],[11,6],[11,12],[12,7],[12,11],[3,9],[9,3],[9,15],[15,9],[7,9],[9,7],[9,11],[11,9]] as [number,number][]).map(([r,c],i)=>(
          <circle key={i} {...pc(r,c)} r={3.2} fill={DEF} stroke="#7a5c2a" strokeWidth="0.6"/>
        ))}
        {([[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[18,6],[18,7],[18,8],[18,9],[18,10],[18,11],[18,12],[6,18],[7,18],[8,18],[9,18],[10,18],[11,18],[12,18],[1,8],[1,9],[1,10],[8,1],[9,1],[10,1],[17,8],[17,9],[17,10],[8,17],[9,17],[10,17]] as [number,number][]).map(([r,c],i)=>(
          <circle key={i} {...pc(r,c)} r={2.8} fill={ATK} stroke="#1a0a02" strokeWidth="0.5"/>
        ))}
        <g className="al-king">
          <circle {...pc(9,9)} r={4} fill={KING_C} stroke="#8a6020" strokeWidth="1"/>
          <circle {...pc(9,9)} r={1.5} fill="#8a6020"/>
        </g>
        <text x="120" y="213" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="8" fontFamily="MedievalSharp,cursive">72 attackers · 24 defenders · 1 king</text>
      </svg>
      )
    })(),
  }

  const svg = svgs[label]
  if (!svg) return <div className="htp-illustration">{label}</div>
  return <div className="htp-illustration htp-illustration--svg">{svg}</div>
}

function HowToPlayScroll({ onClose }: { onClose: () => void }) {
  return (
    <ScrollPage title="How to Play" onClose={onClose}>
      <>
        <p>Before chess took hold, there was Hnefatafl — the Viking strategy game that dominated northern Europe for centuries, until chess arrived from the south and gradually eclipsed it.</p>
        <hr className="credits-page__rule" />
        <h2>The Core Rules</h2>
        <p>You play either the <strong>Attackers</strong>, who surround the board and outnumber their enemy, or the <strong>Defenders</strong>, who guard a King they must escort to safety. Every variant shares a core set of rules.</p>
        <p>These rules apply to every variant.</p>

        <h2>The Board</h2>
        <p>Hnefatafl is played on a square grid. The centre square is the <strong>Throne</strong> — where the King begins. The four corner squares are <strong>escape squares</strong>. Only the King may stand on either.</p>
        <Illustration label="board-overview" />

        <h2>Two Sides</h2>
        <p>The <strong>Attackers</strong> surround the board and move first. Their goal: capture the King. The <strong>Defenders</strong> are outnumbered but protect the King and escort him to a corner.</p>
        <Illustration label="two-sides" />

        <h2>Movement</h2>
        <p>Every piece moves any number of squares in a straight line — horizontally or vertically. No diagonals. No jumping. Corners and the Throne block all pieces except the King.</p>
        <Illustration label="movement" />

        <h2>Capture</h2>
        <p>Sandwich an enemy piece between two of your own on a straight line. The trapped piece is removed immediately. Moving into a sandwich voluntarily is safe — the trap only springs when you close it.</p>
        <Illustration label="capture" />

        <h2>Hostile Squares</h2>
        <p>Empty corners and the empty Throne act as phantom captors. A single friendly piece is enough to capture if an empty special square covers the other side.</p>
        <Illustration label="hostile-squares" />

        <h2>Capturing the King</h2>
        <p>The King requires all four sides sealed simultaneously — by attackers or empty special squares. One open side keeps him safe.</p>
        <Illustration label="king-capture" />

        <h2>King Escapes</h2>
        <p>Move the King to a corner square and the Defenders win. The Attackers must hold every path to every corner the entire game.</p>
        <Illustration label="king-escape" />

        <hr className="credits-page__rule" />
        <h2>The Variants</h2>
        <p>Each variant changes one or two rules. Everything else is the core game above.</p>

        <div className="htp-variants">

          <div className="htp-variant">
            <h3>Copenhagen</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · The modern standard</p>
            <p><strong>Shieldwall:</strong> A line of two or more defenders pressed against the board edge can be wiped out in a single move — flank both ends simultaneously (a corner counts as one flank). The King is immune to shieldwall capture. Strong King, corner escape.</p>
            <Illustration label="shieldwall" />
          </div>

          <div className="htp-variant">
            <h3>Fetlar</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · The Shetland ruleset</p>
            <p>Same board and piece count as Copenhagen but <strong>no shieldwall</strong>. Captures are always one-at-a-time. Strong King, corner escape. Widely played in tournament settings.</p>
          </div>

          <div className="htp-variant">
            <h3>Historical</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · Reconstructed rules</p>
            <p>Based on documented historical records. <strong>Weak King:</strong> once he steps off the Throne, two attackers can sandwich him like any other piece. No shieldwall. Corner escape.</p>
          </div>

          <div className="htp-variant">
            <h3>Tawlbwrdd</h3>
            <p className="htp-variant__tag">11×11 · The Welsh board</p>
            <p><strong>Edge escape:</strong> The King wins by reaching <strong>any square on the board edge</strong> — not just the corners. Much harder to contain him. Includes shieldwall captures. Strong King.</p>
            <Illustration label="edge-escape" />
          </div>

          <div className="htp-variant">
            <h3>Linnaeus Tablut</h3>
            <p className="htp-variant__tag">9×9 · Recorded by Carl Linnaeus in 1732</p>
            <p><strong>Weak King + edge escape:</strong> Once off the Throne, the King can be sandwiched by just two attackers. He escapes to any edge square. Play is faster and more aggressive.</p>
            <Illustration label="weak-king" />
          </div>

          <div className="htp-variant">
            <h3>Saami Tablut</h3>
            <p className="htp-variant__tag">9×9 · The living tradition</p>
            <p>Same rules as Linnaeus Tablut but with a broader starting diamond for the defenders. A slightly more open, tactical opening game.</p>
            <Illustration label="saami-start" />
          </div>

          <div className="htp-variant">
            <h3>Brandub</h3>
            <p className="htp-variant__tag">7×7 · The Irish variant</p>
            <p><strong>Small board, weak King:</strong> Only four defenders and eight attackers. Corner escape. The King's vulnerability means every move matters — there is nowhere to hide.</p>
            <Illustration label="brandub-board" />
          </div>

          <div className="htp-variant">
            <h3>Ard Rí</h3>
            <p className="htp-variant__tag">7×7 · The Irish High King</p>
            <p><strong>Dense 7×7, strong King:</strong> Eight defenders and twelve attackers packed onto the smallest board. The King needs all four sides sealed. Corner escape. Tight, tactical fighting.</p>
            <Illustration label="ard-ri-board" />
          </div>

          <div className="htp-variant">
            <h3>Tyr</h3>
            <p className="htp-variant__tag">15×15 · Modern design by Aage Nielsen</p>
            <p><strong>Weak King, edge escape, no Throne:</strong> The centre square has no special properties — pieces may pass through it freely and it does not assist captures. Edge escape, weak King. The largest competitive board size.</p>
          </div>

          <div className="htp-variant">
            <h3>Simple Tyr</h3>
            <p className="htp-variant__tag">11×11 · Tyr rules on a standard board</p>
            <p>All the Tyr rules — weak King, edge escape, no special Throne — on an 11×11 board. A good entry point to the Tyr family.</p>
          </div>

          <div className="htp-variant">
            <h3>Alea Evangelii</h3>
            <p className="htp-variant__tag">19×19 · The epic</p>
            <p>72 attackers. 24 defenders. A 19×19 board. The same core rules — strong King, corner escape — but the scale changes everything. Openings are deeper, endgames longer, and the King's journey is a true odyssey.</p>
            <Illustration label="alea-board" />
          </div>

        </div>

      </>
    </ScrollPage>
  )
}

function MenuOverlay({ isOpen, isVisible, onResume, onNewGame, onCredits, onHowToPlay, onLeaderboard, onOnlineMatch }: {
  isOpen: boolean
  isVisible: boolean
  onResume: () => void
  onNewGame: (play: 'Vs Machine' | 'Take turns') => void
  onCredits: () => void
  onHowToPlay: () => void
  onLeaderboard: () => void
  onOnlineMatch: (rules: Rules, boardSize: number, side: 'attacker' | 'defender') => void
}) {
  const { cameraLocked, difficulty, rules, boardSize, powerSaving, playerMode, setSetting } = useGameStore()

  const modeToPlay = (m: GameMode): 'Online' | 'Vs Machine' | 'Take turns' =>
    m === '2player' ? 'Take turns' : 'Vs Machine'
  const playToMode = (p: 'Online' | 'Vs Machine' | 'Take turns'): GameMode =>
    p === 'Take turns' ? '2player' : 'defender'

  const [draft, setDraft] = useState({ powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) as 'Online' | 'Vs Machine' | 'Take turns', side: 'attacker' as 'attacker' | 'defender' })

  const validRulesForSize = BOARD_SIZE_RULES[draft.boardSize] ?? []
  const restartValid = validRulesForSize.includes(draft.rules)
  const requiresNewGame = draft.rules !== rules || draft.boardSize !== boardSize || draft.play !== modeToPlay(playerMode)

  // Reset draft when menu opens
  useEffect(() => {
    if (isOpen) setDraft(d => ({ ...d, powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) }))
  }, [isOpen])

  const applyDisplaySettings = () => {
    setSetting('powerSaving', draft.powerSaving)
    setSetting('cameraLocked', draft.cameraLocked)
  }

  const handleResume = () => {
    applyDisplaySettings()
    onResume()
  }

  const handleNewGame = () => {
    if (draft.play === 'Online') { onOnlineMatch(draft.rules, draft.boardSize, draft.side); return }
    applyDisplaySettings()
    setSetting('difficulty', draft.difficulty)
    setSetting('boardSize', draft.boardSize)
    setSetting('rules', draft.rules)
    setSetting('playerMode', playToMode(draft.play))
    onNewGame(draft.play as 'Vs Machine' | 'Take turns')
  }

  const handleCancel = () => {
    setDraft(d => ({ ...d, powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) }))
    onResume()
  }

  if (!isOpen) return null

  return (
    <>
    <div className={`menu-overlay${isVisible ? ' menu-overlay--visible' : ''}`} style={{ opacity: isVisible ? 1 : 0 }}>
      <div className="menu-overlay__screens" style={{ opacity: 1 }}>
        <div className="menu-overlay__screen">
          <div className="settings-panel">
            <div className="settings-row">
              <span className="settings-row__label">Play</span>
              <Cycler<'Online' | 'Vs Machine' | 'Take turns'>
                options={['Online', 'Vs Machine', 'Take turns']}
                value={draft.play}
                onChange={v => setDraft(d => ({ ...d, play: v }))}
              />
            </div>
            <div className="settings-row" style={{ opacity: draft.play === 'Online' ? 1 : 0.25, pointerEvents: draft.play === 'Online' ? undefined : 'none', transition: 'opacity 0.2s ease' }}>
              <span className="settings-row__label">Side</span>
              <Cycler<'attacker' | 'defender'>
                options={['attacker', 'defender']}
                value={draft.side}
                onChange={v => setDraft(d => ({ ...d, side: v }))}
              />
            </div>
            <div className="settings-row" style={{ opacity: draft.play === 'Vs Machine' ? 1 : 0.25, pointerEvents: draft.play === 'Vs Machine' ? undefined : 'none', transition: 'opacity 0.2s ease' }}>
              <span className="settings-row__label">Difficulty</span>
              <Cycler<Difficulty>
                options={['easy', 'medium', 'hard']}
                value={draft.difficulty}
                onChange={v => setDraft(d => ({ ...d, difficulty: v }))}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Board</span>
              <Cycler<string>
                options={ALL_BOARD_SIZES.map(n => `${n}×${n}`)}
                value={`${draft.boardSize}×${draft.boardSize}`}
                onChange={v => {
                  const size = parseInt(v)
                  const valid = BOARD_SIZE_RULES[size] ?? []
                  const newRules = valid.includes(draft.rules) ? draft.rules : (valid[0] ?? draft.rules)
                  setDraft(d => ({ ...d, boardSize: size, rules: newRules }))
                }}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Rules</span>
              <Cycler<Rules>
                options={ALL_RULES}
                value={draft.rules}
                isDisabled={v => !validRulesForSize.includes(v)}
                onChange={v => setDraft(d => ({ ...d, rules: v }))}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Power Saving</span>
              <Toggle on={draft.powerSaving} onClick={() => setDraft(d => ({ ...d, powerSaving: !d.powerSaving, cameraLocked: !d.powerSaving ? true : d.cameraLocked }))} />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">View</span>
              <Cycler<'Free' | 'Top-down'>
                options={['Free', 'Top-down']}
                value={draft.powerSaving ? 'Top-down' : draft.cameraLocked ? 'Top-down' : 'Free'}
                onChange={v => {
                  if (v === 'Top-down') setDraft(d => ({ ...d, cameraLocked: true }))
                  else setDraft(d => ({ ...d, cameraLocked: false, powerSaving: false }))
                }}
              />
            </div>
            <div className="settings-row settings-row--buttons">
              <button className="menu-overlay__item menu-overlay__item--half menu-overlay__item--primary" onClick={handleResume} disabled={requiresNewGame} style={{ opacity: requiresNewGame ? 0.25 : 1, cursor: requiresNewGame ? 'default' : 'pointer' }}>Resume</button>
              <button
                className="menu-overlay__item menu-overlay__item--half menu-overlay__item--primary"
                onClick={handleNewGame}
                disabled={!restartValid}
                style={{ opacity: restartValid ? 1 : 0.35, cursor: restartValid ? 'pointer' : 'default' }}
              >New Game</button>
            </div>
          </div>

          <div className="menu-overlay__row" style={{ marginTop: 8 }}>
            <button className="menu-overlay__item" onClick={onLeaderboard}>Leaderboard</button>
          </div>
          <div className="menu-overlay__row" style={{ marginTop: 8 }}>
            <button className="menu-overlay__item menu-overlay__item--half" onClick={onHowToPlay}>How To</button>
            <button className="menu-overlay__item menu-overlay__item--half" onClick={onCredits}>Credits</button>
          </div>

          <button className="ui-button ui-button--menu" onClick={handleCancel} style={{ marginTop: 8 }}>
            <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
            <span className="ui-button__label">Cancel</span>
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

function PieceIcon({ side }: { side: PlayerSide }) {
  const src = side === 'defender'
    ? `${import.meta.env.BASE_URL}white-piece.png`
    : `${import.meta.env.BASE_URL}blue-piece.png`
  return (
    <img className="score-panel__piece-icon" src={src} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
  )
}

function ScorePanel({ side, isActive, name, elo }: { side: PlayerSide; isActive: boolean; name?: string; elo?: number }) {
  const isAttacker = side === 'attacker'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAttacker ? 'flex-end' : 'flex-start', gap: 3 }}>
      {name && <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#706050', paddingLeft: isAttacker ? 0 : 4, paddingRight: isAttacker ? 4 : 0 }}>{name}</span>}
      <div className={`score-panel score-panel--${side}${isActive ? ' score-panel--active' : ''}`} style={{
        padding: 3,
        borderRadius: 8,
        background: isActive
          ? 'linear-gradient(135deg, #f5e070, #c8880a, #e8c040, #a06808)'
          : 'transparent',
        transition: 'background 0.6s ease',
      }}>
        <div className="score-panel__inner" style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: isAttacker ? 'row-reverse' : 'row',
          gap: elo !== undefined ? 8 : 0,
          background: 'rgba(0,0,0,0.85)',
          borderRadius: 6,
          padding: '8px 14px',
          backdropFilter: 'blur(4px)',
          minWidth: 60,
        }}>
          <PieceIcon side={side} />
          {elo !== undefined && (
            <span style={{ color: '#e8d8b8', fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>{elo}</span>
          )}
        </div>
      </div>
    </div>
  )
}


const winnerEmbers = Array.from({ length: 32 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  const riseVal = -(400 + Math.random() * 500)
  const dx1Val = r(50), dx2Val = r(80), dx3Val = r(40)
  const a1 = Math.atan2(dx1Val, -riseVal * 0.3) * (180 / Math.PI)
  const a2 = Math.atan2(dx2Val - dx1Val, -riseVal * 0.35) * (180 / Math.PI)
  const a3 = Math.atan2(dx3Val - dx2Val, -riseVal * 0.4) * (180 / Math.PI)
  return {
    id: i,
    left: `${10 + (i / 10) * 80 + r(5)}%`,
    bottom: `${2 + Math.random() * 20}%`,
    dur: `${0.8 + Math.random() * 1.2}s`,
    delay: `${-Math.random() * 10}s`,
    rise: `${riseVal}px`,
    dx1: `${dx1Val}px`, dx2: `${dx2Val}px`, dx3: `${dx3Val}px`,
    a1: `${a1.toFixed(1)}deg`, a2: `${a2.toFixed(1)}deg`, a3: `${a3.toFixed(1)}deg`,
    variant: i % 3,
  }
})

function WinnerOverlay({ winner, playerMode, powerSaving, onNewGame, onDismiss }: {
  winner: 'attacker' | 'defender'
  playerMode: GameMode
  powerSaving: boolean
  onNewGame: () => void
  onDismiss: () => void
}) {
  const isPlayer = playerMode === '2player' ? true : (winner === playerMode)
  const isDefeat = !isPlayer && playerMode !== '2player'
  const title = playerMode === '2player' ? 'Victory' : isPlayer ? 'Victory' : 'Defeat'
  const label = winner === 'defender' ? 'Defenders Win' : 'Attackers Win'
  const subtitle = playerMode !== '2player' ? (isPlayer ? 'You Win' : 'You Lose') : null
  return (
    <div className={`winner-overlay${isDefeat ? ' winner-overlay--defeat' : ''}`}>
      {!powerSaving && isDefeat && <DefeatFire />}
      {!powerSaving && !isDefeat && <>
        <div className="winner-overlay__gold1" />
        <div className="winner-overlay__gold2" />
      </>}
      {!powerSaving && winnerEmbers.map(e => (
        <Ember key={e.id} variant={e.variant} style={{
          left: e.left, bottom: e.bottom,
          ['--rise' as string]: e.rise,
          ['--dx1' as string]: e.dx1, ['--dx2' as string]: e.dx2, ['--dx3' as string]: e.dx3,
          ['--a1' as string]: e.a1, ['--a2' as string]: e.a2, ['--a3' as string]: e.a3,
          animationDuration: e.dur,
          animationDelay: e.delay,
        }} />
      ))}
      <div className="winner-overlay__content">
        <p className="winner-overlay__title">{title}</p>
        {subtitle && <p className={`winner-overlay__name winner-overlay__name--${winner}`}>{subtitle}</p>}
        <p style={{ margin: 0, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#a09070' }}>{label}</p>
        <button className="menu-overlay__item" style={{ maxWidth: 280 }} onClick={onNewGame}>New Game</button>
        <button className="winner-overlay__dismiss" onClick={onDismiss}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
          </svg>
          <span>Not right now</span>
        </button>
      </div>
    </div>
  )
}

function RoleSelectOverlay({ onConfirm }: { onConfirm: (mode: GameMode) => void }) {
  return (
    <div className="role-select-overlay">
      <div className="role-select__options">
        <button className="role-select__option" onClick={() => onConfirm('defender')}>
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}white-piece.png`} alt="" />
          <div className="role-select__option-text">
            <span className="role-select__option-name">Defend</span>
            <span className="role-select__option-desc">Escort the King</span>
          </div>
          <div className="role-select__option-spacer" />
        </button>
        <button className="role-select__option" onClick={() => onConfirm('attacker')}>
          <div className="role-select__option-spacer" />
          <div className="role-select__option-text">
            <span className="role-select__option-name">Attack</span>
            <span className="role-select__option-desc">Capture the King</span>
          </div>
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}blue-piece.png`} alt="" />
        </button>
      </div>
    </div>
  )
}

type LeaderboardRow = { id: string; username: string; elo: number; rank: number }

function LeaderboardScroll({ onClose }: { onClose: () => void }) {
  const { userId } = useGameStore()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, username, elo')
      .not('username', 'is', null)
      .order('elo', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setRows(data.map((r, i) => ({ ...r, rank: i + 1 })))
        setLoading(false)
      })
  }, [])

  const myRank = rows.find(r => r.id === userId)?.rank ?? null

  return (
    <ScrollPage title="Leaderboard" onClose={onClose}>
      {loading ? (
        <p style={{ textAlign: 'center', color: '#706050', fontSize: 13 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#706050', fontSize: 13 }}>No ranked players yet. Play an online match to earn your first ELO.</p>
      ) : (
        <>
          {myRank !== null && (
            <p className="leaderboard__my-rank">You are ranked <strong>#{myRank}</strong></p>
          )}
          <div className="leaderboard__table">
            <div className="leaderboard__header">
              <span className="leaderboard__col leaderboard__col--rank">#</span>
              <span className="leaderboard__col leaderboard__col--name">Player</span>
              <span className="leaderboard__col leaderboard__col--elo">ELO</span>
            </div>
            {rows.map(r => (
              <div key={r.id} className={`leaderboard__row${r.id === userId ? ' leaderboard__row--me' : ''}`}>
                <span className="leaderboard__col leaderboard__col--rank">
                  {r.rank <= 3
                    ? ['🥇', '🥈', '🥉'][r.rank - 1]
                    : r.rank}
                </span>
                <span className="leaderboard__col leaderboard__col--name">{r.username}</span>
                <span className="leaderboard__col leaderboard__col--elo">{r.elo}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ScrollPage>
  )
}

function GuestLoginModal({ onLogin, onClose }: {
  onLogin: () => void
  onClose: () => void
}) {
  return (
    <div className="guest-login-modal__backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="guest-login-modal">
        <div className="guest-login-modal__header">
          <span className="guest-login-modal__title">Online Match</span>
          <button className="guest-login-modal__close" onClick={onClose}>✕</button>
        </div>
        <p className="guest-login-modal__body">Log in to play online and track your match history.</p>
        <div className="guest-login-modal__actions">
          <button className="guest-login-modal__btn guest-login-modal__btn--primary" onClick={onLogin}>Log In / Register</button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [introStarted, setIntroStarted] = useState(false)
  const [uiVisible, setUiVisible] = useState(false)
  const [setupAnimating, setSetupAnimating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [winnerDismissed, setWinnerDismissed] = useState(false)
  const [displayWinner, setDisplayWinner] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false)
  const [showLobby, setShowLobby] = useState(false)
  const [showGuestLogin, setShowGuestLogin] = useState(false)
  const [lobbyDraft, setLobbyDraft] = useState<{ rules: Rules; boardSize: number; side: 'attacker' | 'defender' } | null>(null)
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({ type: 'idle' })
  const pendingLobby = useRef<{ rules: Rules; boardSize: number; side: 'attacker' | 'defender' } | null>(null)
  const { currentTurn, resetGame, powerSaving, setSetting, pieces, dyingPieces, winner, playerMode, setPlayerMode, machineMove, difficulty, rules, boardSize, selectedId, selectPiece, movePiece, history, undoMove, gameKey, roleSelectOpen, setRoleSelectOpen, userId, username, elo, setElo, setAuth, setAuthReady, lastMove } = useGameStore()
  const { startGame, sendMove, endGame } = useOnlineGame(setOnlineStatus)

  const handleGameStart = useCallback(async (gameId: string, mySide: 'attacker' | 'defender', gameRules: string, gameBoardSize: number) => {
    setSetting('rules', gameRules as Rules)
    setSetting('boardSize', gameBoardSize as never)
    setPlayerMode(mySide)
    resetGame()
    startGame(gameId, mySide)
    setShowLobby(false)
    setMenuOpen(false)
    // Fetch both players' names + ELOs directly from DB — avoids broadcast timing issues
    const { data } = await supabase
      .from('games')
      .select('attacker:attacker_id(username, elo), defender:defender_id(username, elo)')
      .eq('id', gameId)
      .single()
    if (data) {
      const me = mySide === 'attacker' ? (data.attacker as any) : (data.defender as any)
      const opp = mySide === 'attacker' ? (data.defender as any) : (data.attacker as any)
      if (me?.elo != null) setElo(me.elo)
      setOnlineStatus({ type: 'matched', gameId, opponentName: opp?.username ?? '…', opponentElo: opp?.elo ?? null })
    }
  }, [setSetting, setPlayerMode, resetGame, startGame, setElo, setOnlineStatus])

  const { challenges, myChallenge, hostChallenge, cancelChallenge, acceptChallenge } = useLobby(userId, username ?? null, handleGameStart)

  // Restore session on mount, listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('username, elo').eq('id', session.user.id).single()
        setAuth(session.user.id, profile?.username ?? null, profile?.elo ?? null)
      }
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setAuth(null, null); return }
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('username').eq('id', session.user.id).single()
        const resolvedUsername = profile?.username ?? null
        setAuth(session.user.id, resolvedUsername)
        // After email confirmation, username will be null — prompt them to choose one
        if (event === 'SIGNED_IN' && !resolvedUsername) {
          setShowUsernamePrompt(true)
        }
        // If the user just authenticated to open the lobby, open it now
        if (pendingLobby.current) {
          const pending = pendingLobby.current
          pendingLobby.current = null
          setShowGuestLogin(false)
          setLobbyDraft(pending)
          setShowLobby(true)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Stable hint move — computed once per hint session, cleared on turn change or new game
  const hintMove = useRef<{ pieceId: string; toRow: number; toCol: number } | null>(null)
  useEffect(() => { hintMove.current = null }, [currentTurn, winner])

  // Track whether any move has been made this game (for undo button fade-in)
  const [hasMoved, setHasMoved] = useState(false)
  const prevTurnRef = useRef(currentTurn)
  const prevGameKeyRef = useRef(gameKey)
  useEffect(() => {
    if (gameKey !== prevGameKeyRef.current) {
      setHasMoved(false)
      prevTurnRef.current = currentTurn
      prevGameKeyRef.current = gameKey
      return
    }
    if (currentTurn !== prevTurnRef.current) {
      setHasMoved(true)
      prevTurnRef.current = currentTurn
    }
  }, [currentTurn, gameKey])

  useEffect(() => {
    if (!winner) { setDisplayWinner(null); return }
    const t = setTimeout(() => setDisplayWinner(winner), 1000)
    return () => clearTimeout(t)
  }, [winner])
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Record game result when a winner is decided
  useEffect(() => {
    if (!winner || !userId || playerMode === '2player') return
    const userSide = playerMode // 'attacker' or 'defender'
    const result = winner === userSide ? 'win' : 'loss'
    supabase.from('game_results').insert({
      user_id: userId,
      opponent_type: 'machine',
      result,
      rules,
      board_size: boardSize,
    }).then(({ error }) => { if (error) console.error('game_results insert:', error.message) })
  }, [winner])

  // Broadcast moves in online games
  useEffect(() => {
    if (!lastMove || onlineStatus.type !== 'matched') return
    sendMove(lastMove.pieceId, lastMove.toRow, lastMove.toCol)
  }, [lastMove])

  // End online game when winner decided
  useEffect(() => {
    if (!winner || onlineStatus.type !== 'matched') return
    const winnerId = winner === playerMode ? userId : null
    endGame(winnerId)
  }, [winner])

  // ?ps=true in the URL activates power-saving mode on load
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ps') === 'true') {
      setSetting('powerSaving', true)
    }
  }, [])

  // Machine player — fires after each player move when not in 2-player or online mode
  useEffect(() => {
    if (playerMode === '2player' || onlineStatus.type === 'matched' || winner || roleSelectOpen || setupAnimating) return
    const machineSide: PlayerSide = playerMode === 'attacker' ? 'defender' : 'attacker'
    if (currentTurn !== machineSide) return

    const { center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(rules, boardSize)
    const fire = () => {
      // Read fresh state — pieces may have changed (clearDyingPieces) since the effect ran
      const { pieces: freshPieces, dyingPieces: freshDying, currentTurn: freshTurn, winner: freshWinner, selectedId: freshSelected } = useGameStore.getState()
      if (freshWinner || freshTurn !== machineSide) return
      // If the player still has a piece selected, wait for them to deselect first
      if (freshSelected) { setTimeout(fire, 600); return }
      const alivePieces = freshPieces.filter(p => !freshDying.some(d => d.id === p.id))
      const move = getBestMove(alivePieces, machineSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone)
      if (move) machineMove(move.pieceId, move.toRow, move.toCol)
    }
    const timer = setTimeout(fire, 2200)
    return () => clearTimeout(timer)
  }, [currentTurn, playerMode, onlineStatus.type, winner, roleSelectOpen, setupAnimating])

  const startSetupAnim = () => {
    if (setupTimerRef.current) clearTimeout(setupTimerRef.current)
    setSetupAnimating(true)
    setupTimerRef.current = setTimeout(() => setSetupAnimating(false), getIntroDurationMs(pieces.length))
  }

  // In power-saving mode there's no 3D intro — show UI immediately
  useEffect(() => {
    if (powerSaving) setIntroStarted(true)
  }, [powerSaving])

  // Reset winner dismissed state when a new game starts
  useEffect(() => {
    if (!winner) setWinnerDismissed(false)
  }, [winner])

  // Track when the sceneFadeIn animation completes so buttons start visibly disabled
  useEffect(() => {
    const t = setTimeout(() => setUiVisible(true), powerSaving ? 0 : 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      // Power-saving has no board-flip delay, so show menu instantly
      const delay = powerSaving ? 0 : 500
      const t = setTimeout(() => setMenuVisible(true), delay)
      return () => clearTimeout(t)
    } else {
      setMenuVisible(false)
    }
  }, [menuOpen, powerSaving])

  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>
      <style>{fireCSS}</style>

      {!powerSaving && <>
        {/* Steady dark base — only fades in once loader finishes */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 50% 65%, #2a1200 0%, #0a0800 55%, #000 100%)', opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }} />
        {/* Flickering layers wrapped so their container fades in */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 50% 72%, #5a2400 0%, #1a0800 45%, transparent 70%)',
              animation: 'fireFlicker 2.8s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 46% 78%, #6b2000 0%, transparent 50%)',
              animation: 'fireFlicker 1.9s ease-in-out infinite reverse',
            }}
          />
        </div>

        {/* Mist wisps — fade in container prevents snap-on */}
        {introStarted && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, animation: 'sceneFadeIn 3s ease-out forwards' }}>
            {mists.map(m => (
              <Mist
                key={m.id}
                style={{
                  left: m.left,
                  bottom: m.bottom,
                  width: m.width,
                  height: m.height,
                  ['--dur' as string]: m.dur,
                  ['--mx' as string]: m.mx,
                  ['--peak' as string]: m.peak,
                  animationDelay: m.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* Ember particles — only mount after intro starts */}
        {introStarted && embers.map(e => (
          <Ember
            key={e.id}
            variant={e.variant}
            style={{
              left: e.left,
              bottom: e.bottom,
              ['--rise' as string]: e.rise,
              ['--dx1' as string]: e.dx1,
              ['--dx2' as string]: e.dx2,
              ['--dx3' as string]: e.dx3,
              ['--a1' as string]: e.a1,
              ['--a2' as string]: e.a2,
              ['--a3' as string]: e.a3,
              animationDuration: e.dur,
              animationDelay: e.delay,
            }}
          />
        ))}
      </>}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {powerSaving
            ? <Board2D menuOpen={menuOpen} />
            : <Scene
                onIntroStart={() => { setIntroStarted(true); startSetupAnim() }}
                menuOpen={menuOpen}
                onNewGame={() => { setMenuOpen(false); startSetupAnim() }}
              />
          }
        </div>
        <MenuOverlay
          isOpen={menuOpen}
          isVisible={menuVisible}
          onResume={() => setMenuOpen(false)}
          onNewGame={(play) => {
            setMenuOpen(false)
            if (play === 'Take turns') {
              resetGame()
              startSetupAnim()
            } else {
              setRoleSelectOpen(true)
            }
          }}
          onCredits={() => setShowCredits(true)}
          onHowToPlay={() => setShowHowToPlay(true)}
          onLeaderboard={() => setShowLeaderboard(true)}
          onOnlineMatch={(r, bs, side) => {
            if (!userId) {
              pendingLobby.current = { rules: r, boardSize: bs, side }
              setShowGuestLogin(true)
            } else {
              setLobbyDraft({ rules: r, boardSize: bs, side })
              setShowLobby(true)
            }
          }}
        />
      </div>

      {/* Online match header */}
      {/* Score panels */}
      {introStarted && (() => {
        const isOnline = onlineStatus.type === 'matched'
        const myName = username ?? 'You'
        const opponentName = isOnline ? (onlineStatus.opponentName || '…') : undefined
        const opponentElo = isOnline ? (onlineStatus.opponentElo ?? undefined) : undefined
        const myElo = isOnline ? (elo ?? undefined) : undefined
        const defenderName = isOnline ? (playerMode === 'defender' ? myName : opponentName) : undefined
        const attackerName = isOnline ? (playerMode === 'attacker' ? myName : opponentName) : undefined
        const defenderElo = isOnline ? (playerMode === 'defender' ? myElo : opponentElo) : undefined
        const attackerElo = isOnline ? (playerMode === 'attacker' ? myElo : opponentElo) : undefined
        return <>
          <div className="score-panel-wrapper score-panel-wrapper--defender" style={{ position: 'absolute', bottom: 24, left: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: menuOpen ? 'none' : undefined }}>
            <ScorePanel side="defender" isActive={currentTurn === 'defender'} name={defenderName} elo={defenderElo} />
          </div>
          <div className="score-panel-wrapper score-panel-wrapper--attacker" style={{ position: 'absolute', bottom: 24, right: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: menuOpen ? 'none' : undefined }}>
            <ScorePanel side="attacker" isActive={currentTurn === 'attacker'} name={attackerName} elo={attackerElo} />
          </div>
        </>
      })()}

      <div className="absolute top-1 md:top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="High Kings" className="h-32 w-auto select-none" />
      </div>

      {introStarted && <>
        <div style={{ position: 'absolute', top: '3vw', left: '3vw', zIndex: 15, display: 'flex', gap: '1vw' }}>
          <div className="ui-button-wrapper ui-button-wrapper--hint" style={{ opacity: !uiVisible || menuOpen ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating) ? 'none' : undefined }}>
            <HintButton onClick={() => {
              if (playerMode === '2player' || winner) return
              const humanSide: PlayerSide = playerMode === 'defender' ? 'defender' : 'attacker'
              if (currentTurn !== humanSide) return
              // Compute the hint move once and cache it for this turn
              if (!hintMove.current) {
                const { center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(rules, boardSize)
                const alivePieces = pieces.filter(p => !dyingPieces.some(d => d.id === p.id))
                hintMove.current = getBestMove(alivePieces, humanSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone)
              }
              const move = hintMove.current
              if (!move) return
              if (selectedId === move.pieceId) {
                hintMove.current = null
                movePiece(move.toRow, move.toCol)
              } else {
                selectPiece(move.pieceId)
              }
            }} />
          </div>
          <div className="ui-button-wrapper ui-button-wrapper--undo" style={{ opacity: !uiVisible || menuOpen ? 0 : hasMoved && history.length > 0 ? (setupAnimating ? 0.2 : 1) : 0, transition: 'opacity 0.6s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating || !hasMoved || history.length === 0) ? 'none' : undefined }}>
            <UndoButton onClick={() => {
              if (history.length === 0 || setupAnimating) return
              undoMove()
            }} />
          </div>
        </div>
        <div style={{ position: 'absolute', top: '3vw', right: '3vw', zIndex: 15, display: 'flex', gap: '1vw', opacity: !uiVisible || menuOpen ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating) ? 'none' : undefined }}>
          <div className="ui-button-wrapper ui-button-wrapper--profile">
            <ProfileButton loggedIn={!!userId} onClick={() => userId ? setShowProfile(true) : setShowAuth(true)} />
          </div>
          <div className="ui-button-wrapper ui-button-wrapper--menu">
            <MenuButton isOpen={false} onClick={() => setMenuOpen(o => !o)} />
          </div>
        </div>
      </>}

      <ThemeSwitcher />
      {showProfile && <ProfileScroll onClose={() => setShowProfile(false)} onSignIn={() => setShowAuth(true)} />}
      {showHowToPlay && <HowToPlayScroll onClose={() => setShowHowToPlay(false)} />}
      {showCredits && <CreditsScroll onClose={() => setShowCredits(false)} />}
      {showLeaderboard && <LeaderboardScroll onClose={() => setShowLeaderboard(false)} />}
      {displayWinner && !winnerDismissed && (
        <WinnerOverlay
          winner={displayWinner as 'attacker' | 'defender'}
          playerMode={playerMode}
          powerSaving={powerSaving}
          onNewGame={() => { setRoleSelectOpen(true) }}
          onDismiss={() => setWinnerDismissed(true)}
        />
      )}
      {roleSelectOpen && (
        <RoleSelectOverlay
          onConfirm={(mode) => {
            setPlayerMode(mode)
            resetGame()
            setRoleSelectOpen(false)
            startSetupAnim()
          }}
        />
      )}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showUsernamePrompt && <AuthModal initialScreen="username" onClose={() => setShowUsernamePrompt(false)} />}
      {showGuestLogin && (
        <GuestLoginModal
          onLogin={() => { setShowGuestLogin(false); setShowAuth(true) }}
          onClose={() => { setShowGuestLogin(false); pendingLobby.current = null }}
        />
      )}
      {showLobby && lobbyDraft && (
        <LobbyPanel
          challenges={challenges}
          myChallenge={myChallenge}
          draftRules={lobbyDraft.rules}
          draftBoardSize={lobbyDraft.boardSize}
          draftSide={lobbyDraft.side}
          onHost={() => hostChallenge(lobbyDraft.rules, lobbyDraft.boardSize, lobbyDraft.side)}
          onCancel={() => cancelChallenge()}
          onAccept={acceptChallenge}
          onClose={() => { cancelChallenge(); setShowLobby(false) }}
        />
      )}
      {userId && onlineStatus.type !== 'matched' && !showLobby && challenges.length > 0 && (
        <div className="challenge-invites">
          {challenges.map(c => (
            <div key={c.id} className="challenge-invite">
              <p className="challenge-invite__label">Challenge received</p>
              <p className="challenge-invite__host">{c.host_name}</p>
              <p className="challenge-invite__detail">{c.rules} · {c.board_size}×{c.board_size}</p>
              <p className="challenge-invite__side">You play: <strong>{c.host_side === 'attacker' ? 'Defender' : 'Attacker'}</strong></p>
              <button className="challenge-invite__accept" onClick={() => acceptChallenge(c)}>Accept</button>
            </div>
          ))}
        </div>
      )}
      {onlineStatus.type === 'opponent_disconnected' && (
        <div className="disconnect-banner">
          Opponent disconnected — waiting {onlineStatus.secondsLeft}s…
        </div>
      )}
    </div>
  )
}

export default App
