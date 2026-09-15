const { Types } = require('mongoose');
const Question = require('../dist/models/AptitudeQuestion').default;
const Test = require('../dist/models/AptitudeTest').default;
const controller = require('../dist/controllers/adminAptitude.controller');
const { uploadQuestionImage, deleteQuestionImage, questionImageDirectory } = require('../dist/utils/aptitudeImageUpload');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const validQuestion = { category: 'logical-reasoning', difficulty: 'easy', correctOption: 'B', questionText: '2 + 2?', options: { A: '3', B: '4', C: '5', D: '6' } };
const validTest = { title: 'Aptitude', roundType: 'aptitude', categories: ['logical-reasoning'], durationMinutes: 5,
  difficultyPlan: { easy: { count: 2, marksPerQuestion: 1 }, medium: { count: 0, marksPerQuestion: 2 }, hard: { count: 0, marksPerQuestion: 3 } } };
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
afterEach(() => jest.restoreAllMocks());

test('rejects blank questions, incomplete text options, invalid marks and unknown categories', async () => {
  for (const change of [{ questionText: ' ' }, { options: { A: 'x' } }, { marks: -1 }, { marks: 0 }, { category: 'unknown' }]) {
    await expect(new Question({ ...validQuestion, ...change }).validate()).rejects.toThrow();
  }
  await expect(new Question(validQuestion).validate()).resolves.toBeUndefined();
  await expect(new Question({ ...validQuestion, questionText: '', options: {}, imageUrl: 'https://example.com/question.png' }).validate()).resolves.toBeUndefined();
});

test('creates drafts and rejects publishing when the active bank is short', async () => {
  jest.spyOn(Test.prototype, 'save').mockImplementation(function () { return Promise.resolve(this); });
  const res = response();
  await controller.createTest({ user: { userId: String(new Types.ObjectId()) }, body: validTest }, res);
  expect(res.json.mock.calls[0][0].test.isPublished).toBe(false);
  jest.spyOn(Question, 'find').mockReturnValue({ select: () => ({ lean: async () => [{ _id: new Types.ObjectId(), questionText: 'Only one distinct question' }] }) });
  await expect(controller.createTest({ user: { userId: String(new Types.ObjectId()) }, body: { ...validTest, isPublished: true } }, response()))
    .rejects.toMatchObject({ statusCode: 422 });
});

test('status and publishing APIs reject strings instead of coercing booleans or storing invalid states', async () => {
  await expect(controller.toggleQuestionStatus({ body: { status: 'broken' } }, response())).rejects.toMatchObject({ statusCode: 400 });
  await expect(controller.togglePublishTest({ body: { isPublished: 'false' } }, response())).rejects.toMatchObject({ statusCode: 400 });
  await expect(controller.toggleStudentBlock({ body: { isBlocked: 'false' } }, response())).rejects.toMatchObject({ statusCode: 400 });
});

test('bulk metadata must be an array and every entry must contain a valid question and answer', async () => {
  await expect(controller.bulkCreateQuestions({ body: { meta: '{}' } }, response())).rejects.toMatchObject({ statusCode: 400 });
  const res = response();
  await controller.bulkCreateQuestions({ body: { questions: [{ ...validQuestion, correctOption: undefined }, {}] } }, res);
  expect(res.json.mock.calls[0][0]).toMatchObject({ createdCount: 0, failedCount: 2 });
});

test('rejects invalid images and stores a real JPEG as a separate normalized asset offline', async () => {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  let uploaded;
  try {
    await expect(uploadQuestionImage(Buffer.from('not an image'))).rejects.toMatchObject({ statusCode: 400 });
    const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: 'white' } }).jpeg().toBuffer();
    uploaded = await uploadQuestionImage(jpeg);
    expect(uploaded.url).toMatch(/^\/api\/aptitude\/images\/[a-f0-9-]+\.webp$/);
    const bytes = await fs.readFile(path.join(questionImageDirectory, uploaded.publicId.slice(5)));
    expect((await sharp(bytes).metadata()).format).toBe('webp');
  } finally {
    if (uploaded) await deleteQuestionImage(uploaded.publicId);
    if (previous !== undefined) process.env.CLOUDINARY_CLOUD_NAME = previous;
  }
});
