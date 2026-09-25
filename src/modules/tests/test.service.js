import { TestRepository } from './test.repository.js';
import { NotFoundError } from '../../common/errors/index.js';

export class TestService {
  static async createTest(input) {
    return TestRepository.create({
      name: input.name,
      description: input.description
    });
  }

  static async listTests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, tests] = await Promise.all([
      TestRepository.count(),
      TestRepository.findManyWithCentres(skip, limit)
    ]);

    return {
      data: tests.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        centres: t.centreTests.map((ct) => ({
          centreId: ct.centreId,
          name: ct.centre.name,
          location: ct.centre.location,
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

  static async getTestById(id) {
    const test = await TestRepository.findById(id);

    if (!test) {
      throw new NotFoundError('Diagnostic test not found', 'TEST_NOT_FOUND');
    }

    return {
      id: test.id,
      name: test.name,
      description: test.description,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      centres: test.centreTests.map((ct) => ({
        centreId: ct.centreId,
        name: ct.centre.name,
        location: ct.centre.location,
        price: Number(ct.price)
      }))
    };
  }
}
