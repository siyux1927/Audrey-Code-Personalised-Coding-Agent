export type PhraseScene =
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'running'
  | 'fetching'
  | 'subagent'
  | 'compacting'
  | 'memory'

const pools: Record<PhraseScene, string[]> = {
  thinking:   ['运筹帷幄', '博观约取', '沉吟至今', '踌躇满志', '深思熟虑'],
  reading:    ['韦编三绝', '手不释卷', '一目十行', '博览群书'],
  writing:    ['妙笔生花', '下笔如神', '胸有成竹', '笔走龙蛇'],
  running:    ['雷厉风行', '风驰电掣', '一往无前', '大刀阔斧'],
  fetching:   ['上下求索', '踏破铁鞋', '千里寻觅'],
  subagent:   ['分而治之', '各司其职', '众志成城', '协力同心'],
  compacting: ['删繁就简', '提纲挈领', '化繁为简'],
  memory:     ['铭记于心', '念念不忘', '刻骨铭心'],
}

export function getPhrase(scene: PhraseScene): string {
  const pool = pools[scene]
  return pool[Math.floor(Math.random() * pool.length)]!
}

export { pools }
