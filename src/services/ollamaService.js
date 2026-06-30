const { Ollama } = require('ollama');
const { config } = require('../config');
const recordingIndex = require('./recordingIndex');

const RECORDING_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_recordings',
      description: 'ค้นหาไฟล์บันทึกตามช่องและช่วงเวลา',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'integer', description: 'หมายเลขช่องกล้อง 1-4' },
          startTime: { type: 'string', description: 'ISO 8601 เวลาเริ่ม' },
          endTime: { type: 'string', description: 'ISO 8601 เวลาสิ้นสุด' },
        },
        required: ['channel', 'startTime', 'endTime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recording_at_time',
      description: 'หาไฟล์ที่ครอบคลุมเวลาที่ระบุและคำนวณ seek offset',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'integer', description: 'หมายเลขช่องกล้อง' },
          datetime: { type: 'string', description: 'ISO 8601 เวลาที่ต้องการดู' },
        },
        required: ['channel', 'datetime'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recordings_summary',
      description: 'สรุปรายการไฟล์บันทึกตามช่องหรือวันที่',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'integer' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยค้นหาภาพบันทึก CCTV ตอบเป็นภาษาไทย
เมื่อผู้ใช้ถามเรื่องเวลา ช่องกล้อง หรือไฟล์บันทึก ให้ใช้ tools เสมอ
เมื่อพบไฟล์ที่ตรงเวลา ให้บอกชื่อไฟล์ channel และเวลาให้ชัดเจน`;

function createOllamaClient() {
  const headers = {};
  if (config.ollama.apiKey) {
    headers.Authorization = `Bearer ${config.ollama.apiKey}`;
  }
  return new Ollama({
    host: config.ollama.host,
    headers,
  });
}

function executeTool(name, args, allowedChannels) {
  switch (name) {
    case 'search_recordings':
      return recordingIndex.searchRecordings({
        channel: args.channel,
        startTime: args.startTime,
        endTime: args.endTime,
        allowedChannels,
      });
    case 'get_recording_at_time':
      return recordingIndex.findRecordingAtTime({
        channel: args.channel,
        datetime: args.datetime,
        allowedChannels,
      });
    case 'list_recordings_summary':
      return recordingIndex.listSummary({
        channel: args.channel,
        date: args.date,
        allowedChannels,
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function runChat({ messages, allowedChannels, onEvent }) {
  const ollama = createOllamaClient();
  const conversation = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
  let scopePayload = null;

  for (let step = 0; step < 5; step += 1) {
    const response = await ollama.chat({
      model: config.ollama.model,
      messages: conversation,
      tools: RECORDING_TOOLS,
      stream: false,
    });

    const assistantMessage = response.message;
    conversation.push(assistantMessage);

    if (assistantMessage.tool_calls?.length) {
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const args = toolCall.function.arguments || {};
        const result = executeTool(toolName, args, allowedChannels);

        if (toolName === 'get_recording_at_time' && result) {
          scopePayload = result;
        }

        conversation.push({
          role: 'tool',
          tool_name: toolName,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    if (assistantMessage.content) {
      onEvent({ type: 'content', content: assistantMessage.content });
    }
    if (scopePayload) {
      onEvent({ type: 'scope', payload: scopePayload });
    }
    onEvent({ type: 'done' });
    return;
  }

  onEvent({ type: 'error', message: 'ไม่สามารถประมวลผลคำขอได้' });
  onEvent({ type: 'done' });
}

module.exports = {
  runChat,
  RECORDING_TOOLS,
};
