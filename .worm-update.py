from pathlib import Path
p=Path('src/components/WormTimer.tsx');s=p.read_text().replace('data-full={full} data-reduced={reduce}','data-full={full} data-hungry={bite > 0 && !full} data-reduced={reduce}');p.write_text(s)
p=Path('src/components/WormTimer.css');s=p.read_text();s+='\n.noodle-worm[data-hungry=true] .noodle-face svg{animation:noodle-eager 1.4s ease-in-out infinite;transform-origin:30px 48px}\n@keyframes noodle-eager{0%,70%,100%{transform:rotate(0)}25%{transform:rotate(-3deg)}45%{transform:rotate(2deg)}}\n.noodle-worm[data-reduced=true] .noodle-face svg{animation:none}\n';p.write_text(s)
p=Path('src/worm-preview.tsx');s=p.read_text().replace('useState(.48)','useState(Number(new URLSearchParams(location.search).get("progress") ?? .48))');p.write_text(s)
