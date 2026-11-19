import { motion } from "framer-motion";
import type { Room } from "colyseus.js";
import { HOUSES, KING } from "../../shared/content";
import type { ClientView } from "../../shared/types";
import { play } from "../audio";
import { Crest } from "../components/Crest";
import { HandCrown } from "../components/HandCrown";
import { useCountdown } from "../useCountdown";

/** Antes da primeira carta: quem é o Rei, do que ele gosta e desgosta, e quem começa como Mão do Rei. */
export function Prologue({ view, room }: { view: ClientView; room: Room }) {
  const timer = useCountdown(view.deadline);
  const me = view.players.find((p) => p.id === view.me.id);
  const hand = view.players.find((p) => p.isHand);
  const handHouse = HOUSES.houses.find((h) => h.id === hand?.houseId);
  const humans = view.players.filter((p) => !p.isBot);
  const readyCount = humans.filter((p) => p.isReady).length;
  const eco = HOUSES.economy;

  return (
    <main className="page prologue">
      <motion.header initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <p className="kicker">O conselho se reúne diante do trono</p>
        <h1>
          Rei {KING.name}, {KING.epithet}
        </h1>
        <p className="lead">{KING.intro}</p>
      </motion.header>

      <div className="king-grid">
        <motion.section className="panel likes" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <h2>👍 O Rei gosta de</h2>
          <ul>
            {KING.likes.map((l) => (
              <li key={l.title}>
                <strong>{l.title}.</strong> {l.text}
              </li>
            ))}
          </ul>
        </motion.section>
        <motion.section className="panel dislikes" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <h2>👎 O Rei detesta</h2>
          <ul>
            {KING.dislikes.map((l) => (
              <li key={l.title}>
                <strong>{l.title}.</strong> {l.text}
              </li>
            ))}
          </ul>
        </motion.section>
      </div>

      <motion.section className="panel rules" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
        <h2>Como se ganha o favor do Rei</h2>
        <ul>
          <li>
            Cartas marcadas com <b>👑 Favor do Rei</b> dizem qual lado agrada ao Rei. Quem votar nele ganha Favor do Rei, vença ou perca a
            votação. A barra ao lado de cada brasão mostra o favor de cada um. Todos começam com {eco.startingFavor}.
          </li>
          <li>
            Quem tiver <b>sozinho</b> o maior Favor do Rei toma a coroa e vira a <b>Mão do Rei</b>: num empate, o lado em que a Mão votou vence.
            Ao virar a Mão, o jogador ganha +{eco.handBonus} fichas de voto.
          </li>
          <li>
            Todos começam com <b>{eco.startingTokens} fichas de voto</b>; cada ficha apostada soma +1 ao peso do voto. Ganhe mais fichas
            abstendo-se (+1), roubando do Reino (+1, e o Reino perde 1 ponto) ou virando a Mão do Rei (+{eco.handBonus}).
          </li>
          <li>
            Cuidado com a carta <b>💍 A Mão da Princesa</b>: quem apostar mais no SIM se casa com ela, vira a Mão do Rei até o fim da partida e
            zera o favor de todos.
          </li>
        </ul>
      </motion.section>

      {hand && handHouse && (
        <motion.section
          className="panel first-hand"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.3, type: "spring", stiffness: 140, damping: 14 }}
          onAnimationComplete={() => play("coins")}
        >
          <span className="crest-wrap big">
            <Crest house={handHouse} size={56} />
            <HandCrown size={34} />
          </span>
          <div>
            <h2>{hand.id === view.me.id ? "Você é a primeira Mão do Rei!" : `${hand.name} é a primeira Mão do Rei`}</h2>
            <p className="muted">
              Sorteado entre os conselheiros. Começa com {eco.startingTokens + eco.handBonus} fichas de voto e desempata as votações até alguém
              conquistar mais Favor do Rei.
            </p>
          </div>
        </motion.section>
      )}

      {me && (
        <div className="panel ready">
          <button
            className="btn primary"
            disabled={me.isReady}
            onClick={() => {
              play("confirm");
              room.send("ready");
            }}
          >
            {me.isReady ? "Aguardando os outros…" : "Entendido — abrir o conselho"}
          </button>
          <p className="muted">
            {readyCount}/{humans.length} prontos · a primeira carta é revelada em {timer}
          </p>
        </div>
      )}
    </main>
  );
}
