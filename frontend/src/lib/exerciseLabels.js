// frontend/src/lib/exerciseLabels.js
// French labels for SmartWorkout's enum codes and muscle keys. These are NOT routed
// through lib/i18n.js's t() — that maps English *phrases* to translations, not enum
// codes, and would silently return codes like "PULL_UP_BAR" unchanged. The one
// exception is the 'body weight' sentinel, which already has a working t() entry
// from the pre-swap dataset and stays on that path for backward compatibility.
import { t } from './i18n.js'

function prettify(code) {
  if (!code) return '—'
  return code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export const BODY_PART_LABELS_FR = {
  ABS: 'Abdominaux', BACK: 'Dos', BICEPS: 'Biceps', CHEST: 'Pectoraux',
  FOREARMS: 'Avant-bras', GLUTEUS: 'Fessiers', LEGS: 'Jambes',
  SHOULDERS: 'Épaules', TRICEPS: 'Triceps', CARDIO: 'Cardio',
}

export const EQUIPMENT_LABELS_FR = {
  ASSISTED_MACHINE: 'Machine assistée', BARBELL: 'Barre', BENCH: 'Banc',
  CABLE_MACHINE: 'Machine à câbles', DIP_BARS: 'Barres de dips', DUMBBELL: 'Haltère',
  EZ_BAR: 'Barre EZ', GYMNASTIC_RINGS: 'Anneaux de gym', KETTLEBELL: 'Kettlebell',
  LANDMINE: 'Landmine', MEDICINE_BALL: 'Médecine-ball', PARALLETTES: 'Parallettes',
  PLATE_LOADED_MACHINE: 'Machine à disques', PLYO_BOX: 'Boîte pliométrique',
  PULL_UP_BAR: 'Barre de traction', RACK: 'Rack', RESISTANCE_BAND: 'Bande élastique',
  SELECTORIZED_MACHINE: 'Machine à sélecteur', SLED: 'Traîneau', SMITH_MACHINE: 'Smith Machine',
  SUSPENSION_TRAINER: 'Sangles de suspension', TRAP_BAR: 'Trap Bar',
  TREADMILL: 'Tapis de course', WEIGHT_PLATE: 'Disque',
}

export const MECHANICS_LABELS_FR = { COMPOUND: 'Polyarticulaire', ISOLATION: 'Isolation' }

export const LATERALITY_LABELS_FR = {
  ALTERNATING: 'Alterné', BILATERAL: 'Bilatéral', UNILATERAL: 'Unilatéral',
}

export const WEIGHT_TYPE_LABELS_FR = {
  ASSISTED_WEIGHT: 'Poids assisté', BAND: 'Élastique', BARBELL: 'Barre',
  BODYWEIGHT: 'Poids du corps', DUMBBELL: 'Haltère', MACHINE: 'Machine',
  UNWEIGHTED: 'Sans charge', WEIGHTED: 'Lesté',
}

export const MUSCLE_LABELS_FR = {
  ABS_LOWER: 'Abdominaux inférieurs', ABS_UPPER: 'Abdominaux supérieurs', ABS_OBLIQUES: 'Obliques',
  BACK_LATS: 'Grand dorsal', BACK_TRAPEZIUS_UPPER: 'Trapèze supérieur', BACK_TRAPEZIUS_MIDDLE: 'Trapèze moyen',
  BACK_TRAPEZIUS_LOWER: 'Trapèze inférieur', BACK_INFRASPINATUS: 'Infra-épineux',
  BACK_TERES_MAJOR: 'Grand rond', BACK_TERES_MINOR: 'Petit rond',
  BICEPS_LONG_HEAD: 'Biceps — longue portion', BICEPS_SHORT_HEAD: 'Biceps — courte portion',
  BRACHIORADIALIS: 'Brachio-radial', CHEST_UPPER: 'Pectoral supérieur', CHEST_MIDDLE: 'Pectoral moyen',
  CHEST_LOWER: 'Pectoral inférieur', CHEST_BIG_SWING_MUSCLE: 'Grand pectoral',
  GLUTEUS_MAXIMUS: 'Grand fessier', GLUTEUS_MEDIUS: 'Moyen fessier',
  SHOULDERS_FRONT_PART: 'Deltoïde antérieur', SHOULDERS_MIDDLE_PART: 'Deltoïde latéral',
  SHOULDERS_REAR_PART: 'Deltoïde postérieur', TRICEPS_LATERAL_HEAD: 'Triceps — faisceau latéral',
  TRICEPS_LONG_HEAD: 'Triceps — longue portion', TRICEPS_MEDIAL_HEAD: 'Triceps — faisceau médial',
  QUADRICEPS_RECTUS_FEMORIS: 'Droit fémoral', QUADRICEPS_VASTUS_LATERALIS: 'Vaste latéral',
  QUADRICEPS_VASTUS_MEDIALIS: 'Vaste médial', QUADRICEPS_VASTUS_INTERMEDIUS: 'Vaste intermédiaire',
  ERECTOR_SPINAE: 'Érecteurs du rachis', CLAVES_GASTROCNEMIUS: 'Gastrocnémien',
  CLAVES_SOLEUS_MUSCLE: 'Soléaire', CLAVES_TRIBIALIS: 'Tibial antérieur',
  BICEPS_FEMORIS: 'Biceps fémoral', SEMIMEMBRANOSUS: 'Semi-membraneux', SEMITENDINOSUS: 'Semi-tendineux',
  ADDUCTOR_LONGUS: 'Adducteur long', ADDUCTOR_MAGNUS: 'Grand adducteur',
  FOREARM_EXTENSORS: 'Extenseurs avant-bras', FOREARM_FLEXORS: 'Fléchisseurs avant-bras',
  ILIOPSOAS: 'Ilio-psoas', GRACILIS: 'Gracile', PECTINEUS: 'Pectiné', SARTORIUS: 'Sartorius',
}

export const bodyPartLabel = code => BODY_PART_LABELS_FR[code] || prettify(code)
export const mechanicsLabel = code => MECHANICS_LABELS_FR[code] || prettify(code)
export const lateralityLabel = code => LATERALITY_LABELS_FR[code] || prettify(code)
export const weightTypeLabel = code => WEIGHT_TYPE_LABELS_FR[code] || prettify(code)
export const muscleLabel = key => MUSCLE_LABELS_FR[key] || prettify(key)
export const equipmentLabel = code => {
  if (!code) return '—'
  if (code === 'body weight') return t(code) // legacy sentinel, kept on the old t() path
  return EQUIPMENT_LABELS_FR[code] || prettify(code)
}
