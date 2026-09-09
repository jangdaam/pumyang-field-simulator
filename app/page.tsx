'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  Compass,
  Crosshair,
  Expand,
  HelpCircle,
  Map,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  HardHat,
  ChevronRight,
} from 'lucide-react';
import type { FieldEngine, FieldState } from '../lib/field/engine';
import { equipment } from '../lib/field/catalog';
const initial: FieldState = {
  ready: false,
  mode: 'walk',
  viewPreference: 'top',
  cameraMode: 'top',
  selected: null,
  near: null,
  speed: 0,
  heading: 0,
  boom: 0,
  cable: 0,
  jaw: 0,
  active: false,
  x: -29,
  z: 29,
  zone: '장비 야드',
  map: false,
  paused: false,
  workers: 24,
  fps: 60,
  waypoint: null,
  distance: 0,
  visited: [],
  error: null,
  labels: [],
};
const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd>{children}</kbd>
);
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    mini = useRef<HTMLCanvasElement>(null),
    labelHost = useRef<HTMLDivElement>(null),
    engine = useRef<FieldEngine | null>(null);
  const [s, setS] = useState(initial),
    [help, setHelp] = useState(false),
    [sound, setSound] = useState(false),
    [panel, setPanel] = useState(true);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    import('../lib/field/engine')
      .then(({ FieldEngine }) => {
        if (disposed || !host.current || !mini.current || !labelHost.current)
          return;
        const e = new FieldEngine(
          host.current,
          mini.current,
          setS,
          labelHost.current,
        );
        engine.current = e;
        cleanup = () => e.dispose();
      })
      .catch((e) => setS((v) => ({ ...v, error: String(e) })));
    return () => {
      disposed = true;
      cleanup?.();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) setHelp((v) => !v);
      if (e.code === 'Escape' && help) setHelp(false);
      if (e.code === 'Tab' && !help && !s.paused) {
        e.preventDefault();
        setPanel((v) => !v);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [help, s.paused]);
  useEffect(() => {
    engine.current?.setHelp(help);
  }, [help]);
  const machine = equipment.find((e) => e.id === s.selected),
    nearby = equipment.find((e) => e.id === s.near);
  return (
    <main className={`field-app view-${s.cameraMode}`}>
      <div
        className="world"
        ref={host}
        aria-label="범양 토목 현장 3D 시뮬레이션"
      />
      <div className="vignette" />
      <div className="view-switch" aria-label="시점 선택">
        <span>
          {s.cameraMode === 'map'
            ? '전체 지도'
            : s.cameraMode === 'first'
              ? '1인칭 보행'
              : s.cameraMode === 'tps'
                ? '장비 TPS'
                : '탑뷰'}
        </span>
        <button
          disabled={s.map || s.paused || help}
          aria-pressed={s.viewPreference === 'first'}
          onClick={() => engine.current?.toggleView()}
        >
          <Key>V</Key>
          {s.viewPreference === 'first' ? '탑뷰로 전환' : '1인칭 모드'}
        </button>
      </div>
      {s.cameraMode === 'first' && (
        <>
          <div className="eye-reticle" aria-hidden="true" />
          <div className="look-hint">
            마우스 이동 · 둘러보기{' '}
            <span>화면 클릭 · 커서 고정 / Esc · 해제</span>
          </div>
        </>
      )}

      <header className="topbar">
        <div className="identity">
          <div className="header-company-logo">
            <Image
              src="/pumyang-logo.svg"
              alt="(주)범양이엔씨"
              width={242}
              height={52}
              unoptimized
            />
          </div>
          <i />
          <div className="title-block">
            <h1>범양 현장훈련장</h1>
            <span>자유 탐색 · 장비 조작</span>
          </div>
        </div>
        <div className="top-actions">
          <span className="time">
            <span className="sun-icon" />
            16:40 <i />
            맑음
          </span>
          <button
            className="icon-button"
            aria-label={sound ? '소리 끄기' : '소리 켜기'}
            onClick={() => {
              setSound(!sound);
              engine.current?.setSound(!sound);
            }}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            className="icon-button"
            aria-label="조작 도움말"
            onClick={() => setHelp(true)}
          >
            <HelpCircle />
          </button>
          <button
            className="icon-button"
            aria-label="일시정지"
            onClick={() => engine.current?.togglePause()}
          >
            <Pause />
          </button>
        </div>
      </header>
      <section className="location">
        <span className="live-dot" />
        현장 개방<span className="sep">/</span>
        <strong>{s.zone}</strong>
        <span className="location-coord">
          {s.x.toFixed(0)} E · {s.z.toFixed(0)} S
        </span>
      </section>
      {panel && (
        <aside className="fleet-panel">
          <div className="panel-heading">
            <span>현장 장비</span>
            <span>{String(equipment.length).padStart(2, '0')}</span>
          </div>
          <p className="fleet-caption">
            가까이 다가가 <Key>F</Key> 탑승
          </p>
          {equipment.map((e, i) => (
            <button
              key={e.id}
              className={`fleet-item ${s.selected === e.id ? 'selected' : ''} ${s.waypoint === e.id ? 'tracked' : ''}`}
              onClick={() => engine.current?.guideTo(e.id)}
              aria-label={`${e.name} 위치 안내`}
            >
              <span className="fleet-num">0{i + 1}</span>
              <span className="fleet-copy">
                <strong>{e.name}</strong>
                <small>{e.model}</small>
              </span>
              <span className="fleet-end">
                {s.selected === e.id ? (
                  <span className="aboard">탑승 중</span>
                ) : s.visited.includes(e.id) ? (
                  <span className="live-dot" />
                ) : (
                  <ArrowUpRight size={15} />
                )}
              </span>
            </button>
          ))}
          <div className="fleet-footer">
            <HardHat size={14} />
            <span>작업자 {s.workers}명 · 순회 장비 4대</span>
            <span className="live-dot" />
          </div>
        </aside>
      )}
      <div className="world-labels" ref={labelHost} aria-hidden="true" />
      <aside className="map-panel">
        <div className="map-heading">
          <span>
            <Compass size={15} /> SITE MAP
          </span>
          <button
            aria-label={s.map ? '현장 시점으로' : '전체 지도 보기'}
            onClick={() => engine.current?.toggleMap()}
          >
            <Expand size={14} />
          </button>
        </div>
        <canvas width="440" height="330" ref={mini} aria-label="현장 미니맵" />
        <div className="map-footer">
          <span>
            <i />내 위치
          </span>
          <span>180 × 140 m</span>
        </div>
      </aside>
      {s.waypoint && s.mode === 'walk' && (
        <div className="waypoint">
          <Compass size={17} />
          <span>{equipment.find((e) => e.id === s.waypoint)?.name}</span>
          <strong>{Math.round(s.distance)} m</strong>
          <button
            onClick={() => engine.current?.guideTo(null)}
            aria-label="안내 취소"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="bottom-stack">
        {!s.selected && !s.map && (
          <div className={`interaction ${nearby ? 'available' : ''}`}>
            <span className="interaction-key">
              {nearby ? 'F' : <HardHat size={22} />}
            </span>
            <div>
              <strong>
                {nearby ? `${nearby.name} 탑승` : '현장을 자유롭게 둘러보세요'}
              </strong>
              <span>
                {nearby
                  ? `${nearby.model} · 탑승 후 직접 조작`
                  : 'WASD 이동 · 가까운 장비에서 F 탑승'}
              </span>
            </div>
            {nearby && (
              <button onClick={() => engine.current?.interact()}>
                탑승하기
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        )}
        {machine && !s.map && (
          <section
            className={`cockpit ${machine.id === 'truck' ? 'truck-cockpit' : ''}`}
          >
            <div className="cockpit-title">
              <span className="cockpit-icon">
                0{equipment.indexOf(machine) + 1}
              </span>
              <div>
                <small>장비 조작 중</small>
                <strong>
                  {machine.name}
                  <span>{machine.model}</span>
                </strong>
              </div>
              <button onClick={() => engine.current?.interact()}>
                <Key>F</Key> 하차
              </button>
            </div>
            <div className="telemetry">
              <div>
                <small>주행 속도</small>
                <strong>
                  {s.speed.toFixed(1)}
                  <em>km/h</em>
                </strong>
              </div>
              <div>
                <small>{machine.id === 'truck' ? '진행 방향' : '선회각'}</small>
                <strong>
                  {Math.round(s.heading)}
                  <em>°</em>
                </strong>
              </div>
              {machine.id !== 'truck' && (
                <>
                  <div>
                    <small>
                      {machine.id === 'cutter' ? '가이드 각도' : '붐 각도'}
                    </small>
                    <strong>
                      {Math.round(s.boom)}
                      <em>°</em>
                    </strong>
                  </div>
                  <div>
                    <small>와이어 길이</small>
                    <strong>
                      {s.cable.toFixed(1)}
                      <em>m</em>
                    </strong>
                  </div>
                </>
              )}
              <div className="machine-state">
                <span className="live-dot" />
                {s.active ? '작동 중' : '대기 중'}
              </div>
            </div>
            <div className="machine-controls">
              <span>
                <Key>W S</Key>전·후진
              </span>
              <span>
                <Key>A D</Key>조향
              </span>
              {machine.id !== 'truck' && (
                <>
                  <span>
                    <Key>Q E</Key>선회
                  </span>
                  <span>
                    <Key>↑ ↓</Key>붐
                  </span>
                  <span>
                    <Key>T G</Key>권상·하강
                  </span>
                </>
              )}
              {machine.id === 'truck' && (
                <span>
                  <Key>Space</Key>브레이크
                </span>
              )}
              {machine.id === 'grab' && (
                <span>
                  <Key>Z X</Key>그랩 개폐
                </span>
              )}
              {machine.id === 'cutter' && (
                <span>
                  <Key>Z</Key>커터 회전
                </span>
              )}
            </div>
          </section>
        )}
        <footer className="control-bar">
          <div className="mode-indicator">
            <span className="live-dot" />
            {s.map
              ? '전체 현장'
              : s.selected
                ? s.cameraMode === 'tps'
                  ? '장비 TPS'
                  : '장비 조작'
                : s.cameraMode === 'first'
                  ? '1인칭 보행'
                  : '도보 탐색'}
          </div>
          <div className="quick-keys">
            {s.map ? null : !s.selected ? (
              <span>
                <Key>W A S D</Key>이동 <Key>Shift</Key>달리기
              </span>
            ) : (
              <span>
                <Key>Space</Key>즉시 정지
              </span>
            )}
            <span>
              <Key>M</Key>지도
            </span>
            <span>
              <Key>C</Key>시점 회전
            </span>
            <span className="scroll-hint">
              {s.cameraMode === 'first'
                ? '마우스 이동 · 둘러보기'
                : '휠 · 확대/축소'}
            </span>
            <button onClick={() => setHelp(true)}>
              <Key>H</Key>조작법
            </button>
          </div>
          <button
            className="center-camera"
            onClick={() => engine.current?.centerCamera()}
            aria-label="카메라 정렬"
          >
            <Crosshair size={18} />
          </button>
        </footer>
      </div>
      {s.map && (
        <div className="map-view-badge">
          <Map size={18} />
          전체 현장
          <button onClick={() => engine.current?.toggleMap()}>
            <Key>M</Key> 돌아가기
          </button>
        </div>
      )}
      {!s.ready && !s.error && (
        <div className="loading-screen">
          <span className="brand-symbol">
            <Image
              src="/pumyang-symbol.svg"
              alt=""
              width={34}
              height={34}
              unoptimized
            />
          </span>
          <h2>현장을 준비하고 있습니다</h2>
          <div className="loading-track">
            <i />
          </div>
        </div>
      )}
      {s.error && (
        <div className="overlay">
          <div className="dialog">
            <h2>3D 화면을 시작하지 못했습니다</h2>
            <p>브라우저의 하드웨어 가속을 확인한 후 다시 열어 주세요.</p>
            <button className="primary" onClick={() => location.reload()}>
              다시 시작
            </button>
          </div>
        </div>
      )}
      {(help || s.paused) && (
        <div className="overlay">
          <dialog
            open
            className="dialog"
            aria-modal="true"
            aria-label={help ? '조작 안내' : '일시정지'}
          >
            <button
              className="dialog-close"
              aria-label="닫기"
              onClick={() => {
                setHelp(false);
                engine.current?.setPaused(false);
              }}
            >
              <X />
            </button>
            <span className="eyebrow">PUMYANG FIELD GUIDE</span>
            <h2>
              {help ? '현장에 오신 것을 환영합니다.' : '잠시 쉬어가세요.'}
            </h2>
            <p>
              1인칭으로 현장을 걷고, 탑승하면 가까운 후방 TPS 시점에서 장비를
              조작하세요. V로 기존 탑뷰도 선택할 수 있습니다.
            </p>
            <div className="help-grid">
              <div>
                <h3>현장 탐색</h3>
                {[
                  ['W A S D', '보는 방향으로 이동'],
                  ['V', '탑뷰 / 1인칭 모드 전환'],
                  ['마우스 이동 / 방향키', '1인칭에서 시선 회전'],
                  ['Shift', '빠르게 이동'],
                  ['F', '가까운 장비 탑승 / 하차'],
                  ['M', '전체 현장 보기'],
                  ['C', '시점 90° 회전'],
                  ['Tab', '장비 목록 접기 / 펼치기'],
                ].map(([k, v]) => (
                  <p key={k}>
                    <Key>{k}</Key>
                    <span>{v}</span>
                  </p>
                ))}
              </div>
              <div>
                <h3>장비 조작</h3>
                {[
                  ['W S / A D', '전·후진 / 조향'],
                  ['Q E', '상부 선회'],
                  ['↑ ↓', '붐 올리기 / 내리기'],
                  ['T G', '와이어 감기 / 풀기'],
                  ['Z / X', '커터 회전 / 그랩 개폐'],
                  ['Space', '누르는 동안 즉시 정지'],
                ].map(([k, v]) => (
                  <p key={k}>
                    <Key>{k}</Key>
                    <span>{v}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="reference-note">
              <strong>브로슈어를 바탕으로 재구성한 토목 현장</strong>
              <span>
                장비 현황 p.10–13 · PPS 현장 p.26–27 참고. 형태와 움직임을
                단순화한 자유 조작 모드입니다.
              </span>
            </div>
            <div className="dialog-actions">
              <button
                className="secondary"
                onClick={() => {
                  engine.current?.reset();
                  setHelp(false);
                }}
              >
                <RotateCcw size={16} />
                시작 위치로
              </button>
              <button
                className="primary"
                onClick={() => {
                  setHelp(false);
                  engine.current?.setPaused(false);
                }}
              >
                <Play size={16} />
                {help ? '현장 탐색하기' : '계속하기'}
              </button>
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
