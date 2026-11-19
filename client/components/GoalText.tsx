import { RESOURCE_LABEL, type ClientView, type Goal } from "../../shared/types";

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** As duas linhas de um objetivo secreto: recursos altos e moderados, com as faixas. */
export function GoalText({ goal, ranges }: { goal: Goal; ranges: ClientView["ranges"] }) {
  const [hl, hh] = ranges.high;
  const [ml, mh] = ranges.moderate;
  return (
    <>
      <p>
        Entre {fmt(hl)} e {fmt(hh)}: <strong>{goal.high.map((r) => RESOURCE_LABEL[r]).join(", ")}</strong>
      </p>
      <p>
        Entre {fmt(ml)} e {fmt(mh)}: <strong>{goal.moderate.map((r) => RESOURCE_LABEL[r]).join(", ")}</strong>
      </p>
    </>
  );
}
