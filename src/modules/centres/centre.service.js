import { CentreRepository } from './centre.repository.js';
import { TestRepository } from '../tests/test.repository.js';
import { NotFoundError, ConflictError } from '../../common/errors/index.js';

export class CentreService {
  static async createCentre(input) {
    return CentreRepository.create({
      name: input.name,
      location: input.location
    });
  }

  static async listCentres(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, centres] = await Promise.all([
      CentreRepository.count(),
      CentreRepository.findManyWithTests(skip, limit)
    ]);

    return {
      data: centres.map((c) => ({
        id: c.id,
        name: c.name,
        location: c.location,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        tests: c.centreTests.map((ct) => ({
          testId: ct.testId,
          name: ct.test.name,
          description: ct.test.description,
          price: Number(ct.price)
        }))
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getCentreById(id) {
    const centre = await CentreRepository.findById(id);

    if (!centre) {
      throw new NotFoundError('Diagnostic centre not found', 'CENTRE_NOT_FOUND');
    }

    return {
      id: centre.id,
      name: centre.name,
      location: centre.location,
      createdAt: centre.createdAt,
      updatedAt: centre.updatedAt,
      tests: centre.centreTests.map((ct) => ({
        testId: ct.testId,
        name: ct.test.name,
        description: ct.test.description,
        price: Number(ct.price)
      }))
    };
  }

  static async addTestToCentre(centreId, input) {
    const centre = await CentreRepository.findById(centreId);
    if (!centre) {
      throw new NotFoundError('Diagnostic centre not found', 'CENTRE_NOT_FOUND');
    }

    const test = await TestRepository.findById(input.testId);
    if (!test) {
      throw new NotFoundError('Diagnostic test not found', 'TEST_NOT_FOUND');
    }

    const existing = await CentreRepository.findCentreTest(centreId, input.testId);
    if (existing) {
      throw new ConflictError('This test is already registered at this centre', 'CENTRE_TEST_ALREADY_EXISTS');
    }

    const centreTest = await CentreRepository.createCentreTest({
      centreId,
      testId: input.testId,
      price: input.price
    });

    return {
      id: centreTest.id,
      centreId: centreTest.centreId,
      centreName: centreTest.centre.name,
      testId: centreTest.testId,
      testName: centreTest.test.name,
      price: Number(centreTest.price),
      createdAt: centreTest.createdAt
    };
  }

  static async getCentreTests(centreId) {
    const centre = await CentreRepository.findById(centreId);
    if (!centre) {
      throw new NotFoundError('Diagnostic centre not found', 'CENTRE_NOT_FOUND');
    }

    const centreTests = await CentreRepository.findTestsByCentreId(centreId);

    return centreTests.map((ct) => ({
      id: ct.id,
      centreId: ct.centreId,
      testId: ct.testId,
      name: ct.test.name,
      description: ct.test.description,
      price: Number(ct.price),
      createdAt: ct.createdAt
    }));
  }
}
