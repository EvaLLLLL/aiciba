/**
 * The workflow graph, as data. Alfred rewrites info.plist whenever a workflow is
 * edited in its UI, so this file stays the source of truth and the build script
 * converts it with `plutil`. Object UIDs are fixed: Alfred matches them when a
 * user reinstalls, which is what preserves their hotkey and configuration.
 */

export const BUNDLE_ID = 'com.evalllll.aiciba'

const SCRIPT_FILTER = 'C51D4423-759F-4595-8A39-6B9860D23735'
const CONDITIONAL = '8611AF12-FC15-4317-BFE2-7196EA7394BE'
const ACTION_SCRIPT = 'DC1D4CA4-45DA-4D41-AD63-12464C9246F0'
const COPY_TO_CLIPBOARD = '1C2EBDE8-BE72-432F-AC51-B835BDC49241'
const SPEAK = '3149DF2C-D03B-4727-BC42-E234D2075383'
const UNIVERSAL_ACTION = '44C0C07A-4140-405E-B37F-0ADD920F8FFF'
const HOTKEY = 'CD191FDE-FF36-44C3-8795-32BBBCD31870'

// Conditional branches are addressed by their own UIDs, via `sourceoutputuid`.
const BRANCH_RUN = '090AF248-6D61-41B0-B564-167841FAF0C4'
const BRANCH_COPY = '7A1E4D9C-3F20-4A1B-9E77-51C0A2D6B8E4'
const BRANCH_PLAY = 'F3B7C0A5-9E48-4D62-8B1A-6C4D9E2F70B3'

/** Alfred stores modifier keys as Cocoa flag masks. */
const ALT = 1 << 19

/**
 * `vitoclose` is Alfred's "Don't close the Alfred window on actioning the
 * result", and it lives on the connection leaving the input object — so it is
 * per modifier, never per row.
 */
const connection = (destinationuid, extra = {}) => ({
  destinationuid,
  modifiers: 0,
  modifiersubtext: '',
  vitoclose: false,
  ...extra
})

export function workflow({
  version,
  description,
  webaddress,
  createdby,
  readme
}) {
  return {
    bundleid: BUNDLE_ID,
    name: 'AICIBA',
    description,
    category: 'Tools',
    createdby,
    webaddress,
    version,
    readme,
    disabled: false,
    // Never travels with an exported workflow.
    variablesdontexport: ['AICIBA_API_KEY'],
    connections: {
      [UNIVERSAL_ACTION]: [connection(SCRIPT_FILTER, { vitoclose: true })],
      [HOTKEY]: [connection(SCRIPT_FILTER)],
      [SCRIPT_FILTER]: [
        // Alfred stays up: hearing a word should not dismiss the entry you are
        // reading. The cost is that copying leaves the window open too — ⎋
        // closes it — because Alfred cannot vary this per row.
        connection(CONDITIONAL, { vitoclose: true }),
        connection(SPEAK, {
          modifiers: ALT,
          modifiersubtext: 'Pronounce the word',
          vitoclose: true
        })
      ],
      [CONDITIONAL]: [
        connection(ACTION_SCRIPT, { sourceoutputuid: BRANCH_RUN }),
        connection(COPY_TO_CLIPBOARD, { sourceoutputuid: BRANCH_COPY }),
        connection(SPEAK, { sourceoutputuid: BRANCH_PLAY })
      ]
    },
    objects: [
      {
        uid: UNIVERSAL_ACTION,
        type: 'alfred.workflow.trigger.universalaction',
        version: 1,
        config: {
          acceptsfiles: false,
          acceptsmulti: 0,
          acceptstext: true,
          acceptsurls: false,
          name: 'Look up in AICIBA'
        }
      },
      {
        uid: HOTKEY,
        type: 'alfred.workflow.trigger.hotkey',
        version: 2,
        config: {
          // No key assigned: `argument: 1` feeds the macOS selection to the filter.
          action: 0,
          argument: 1,
          focusedappvariable: false,
          focusedappvariablename: '',
          leftcursor: false,
          modsmode: 0,
          relatedAppsMode: 0
        }
      },
      {
        uid: SCRIPT_FILTER,
        type: 'alfred.workflow.input.scriptfilter',
        version: 3,
        config: {
          // The script decides every row, including which history entries match.
          alfredfiltersresults: false,
          alfredfiltersresultsmatchmode: 0,
          argumenttreatemptyqueryasnil: true,
          argumenttrimmode: 0,
          // Optional argument: no query browses recent lookups.
          argumenttype: 1,
          escaping: 0,
          keyword: '{var:ciba_keyword}',
          queuedelaycustom: 3,
          queuedelayimmediatelyinitially: true,
          // Runs on every keystroke, which is affordable because it only reads the cache.
          queuedelaymode: 0,
          queuemode: 1,
          runningsubtext: '',
          script: '',
          scriptargtype: 1,
          scriptfile: 'scripts/filter.sh',
          skipuniversalaction: true,
          subtext: 'Look up a word, in either configured language',
          title: 'AICIBA',
          type: 8,
          withspace: true
        }
      },
      {
        uid: CONDITIONAL,
        type: 'alfred.workflow.utility.conditional',
        version: 1,
        config: {
          hideelse: true,
          elselabel: 'else',
          conditions: [
            {
              uid: BRANCH_RUN,
              inputstring: '{var:mode}',
              matchcasesensitive: false,
              matchmode: 0,
              matchstring: 'run',
              outputlabel: 'run'
            },
            {
              uid: BRANCH_COPY,
              inputstring: '{var:mode}',
              matchcasesensitive: false,
              matchmode: 0,
              matchstring: 'copy',
              outputlabel: 'copy'
            },
            {
              uid: BRANCH_PLAY,
              inputstring: '{var:mode}',
              matchcasesensitive: false,
              matchmode: 0,
              matchstring: 'play',
              outputlabel: 'play'
            }
          ]
        }
      },
      {
        uid: ACTION_SCRIPT,
        type: 'alfred.workflow.action.script',
        version: 2,
        config: {
          concurrently: false,
          escaping: 0,
          script: '',
          scriptargtype: 1,
          scriptfile: 'scripts/action.sh',
          type: 8
        }
      },
      {
        uid: COPY_TO_CLIPBOARD,
        type: 'alfred.workflow.output.clipboard',
        version: 3,
        config: {
          autopaste: false,
          clipboardtext: '{query}',
          ignoredynamicplaceholders: false,
          transient: false
        }
      },
      {
        uid: SPEAK,
        type: 'alfred.workflow.action.script',
        version: 2,
        config: {
          concurrently: true,
          escaping: 0,
          script: '',
          scriptargtype: 1,
          scriptfile: 'scripts/pronounce.sh',
          type: 8
        }
      }
    ],
    uidata: {
      [UNIVERSAL_ACTION]: { xpos: 40, ypos: 45, note: 'selected text' },
      [HOTKEY]: { xpos: 40, ypos: 180, note: 'selected text' },
      [SCRIPT_FILTER]: {
        xpos: 250,
        ypos: 105,
        note: 'cache only — never calls the API'
      },
      [CONDITIONAL]: { xpos: 470, ypos: 60 },
      [ACTION_SCRIPT]: {
        xpos: 680,
        ypos: 25,
        note: 'ask the AI, then re-open Alfred'
      },
      [COPY_TO_CLIPBOARD]: { xpos: 680, ypos: 160, note: 'definition' },
      [SPEAK]: { xpos: 470, ypos: 380, note: 'recording, or speech' }
    },
    userconfigurationconfig: [
      {
        type: 'textfield',
        variable: 'ciba_keyword',
        label: 'Keyword',
        description: '',
        config: {
          default: 'c',
          placeholder: 'c',
          required: true,
          trim: true
        }
      },
      {
        type: 'textfield',
        variable: 'AICIBA_ENTRY_LANGUAGE',
        label: 'Look Up',
        description:
          'Language of the words you look up. Empty follows `ciba --config`.',
        config: {
          default: '',
          placeholder: 'English',
          required: false,
          trim: true
        }
      },
      {
        type: 'textfield',
        variable: 'AICIBA_DEFINITION_LANGUAGE',
        label: 'Define In',
        description:
          'Language the definitions are written in. Empty follows `ciba --config`.',
        config: {
          default: '',
          placeholder: 'Chinese',
          required: false,
          trim: true
        }
      },
      {
        type: 'popupbutton',
        variable: 'AICIBA_ACCENT',
        label: 'Accent',
        description:
          'Chooses both the recording and the phonetic transcription. Recordings come from Youdao; macOS speech fills the gaps.',
        config: {
          default: 'us',
          pairs: [
            ['American', 'us'],
            ['British', 'uk']
          ]
        }
      },
      {
        type: 'popupbutton',
        variable: 'AICIBA_PROVIDER',
        label: 'Provider',
        description: 'Leave as “From ciba CLI” to reuse ~/.aiciba/config.json.',
        config: {
          default: '',
          pairs: [
            ['From ciba CLI', ''],
            ['Anthropic (Claude)', 'anthropic'],
            ['OpenAI (GPT)', 'openai'],
            ['Google (Gemini)', 'gemini']
          ]
        }
      },
      {
        type: 'textfield',
        variable: 'AICIBA_API_KEY',
        label: 'API Key',
        description:
          'Stored in Alfred’s preferences and excluded from workflow exports. Leave empty to use the key from ~/.aiciba/config.json.',
        config: {
          default: '',
          placeholder: 'sk-…',
          required: false,
          trim: true
        }
      },
      {
        type: 'textfield',
        variable: 'AICIBA_MODEL',
        label: 'Model',
        description:
          'Empty picks the provider’s fastest model. Set this to run a quick model in Alfred while the ciba CLI keeps a heavier one.',
        config: {
          default: '',
          placeholder: 'gpt-5.4-mini',
          required: false,
          trim: true
        }
      },
      {
        type: 'textfield',
        variable: 'aiciba_node',
        label: 'Node Path',
        description:
          'Only needed when the workflow cannot find Node 18+ on its own (`which node` in Terminal).',
        config: {
          default: '',
          placeholder: '/opt/homebrew/bin/node',
          required: false,
          trim: true
        }
      }
    ]
  }
}
