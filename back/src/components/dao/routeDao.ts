import { Db, ClientSession } from 'mongodb';
import { Route, Stop } from '../../model/routesModel';
import { Schedule } from '../../model/routesModel';
export class RouteDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insertRoute(route: Partial<Route>) {
    try {
      const result = await this.db.collection('routes').insertOne(route);
      return result.insertedId;
    } catch (error) {
      throw error;
    }
  }

  async updateRoute(nameIt: string, nameEn: string, stops: Stop[], ticketTypes: string[], routeId: string, enabled: boolean) {
    try {
      const result = await this.db.collection('routes').updateOne(
        { id: routeId },
        {
          $set: {
            'name.it': nameIt,
            'name.en': nameEn,
            stops: stops,
            enabled: enabled,
            ticketTypes: ticketTypes,
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  async getRoutes() {
    try {
      const routes = await this.db.collection('routes').find().toArray();
      return routes;
    } catch (error) {
      throw error;
    }
  }

  async getRouteById(id: string) {
    try {
      const route = await this.db.collection('routes').findOne({ id: id });
      return route;
    } catch (error) {
      throw error;
    }
  }

  async deleteRoute(id: string) {
    try {
      const result = await this.db.collection('routes').deleteOne({ id: id });
      return result.deletedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  async getEnabledRoutes() {
    try {
      const routes = await this.db.collection('routes').find({ enabled: true }).toArray();
      return routes;
    } catch (error) {
      throw error;
    }
  }

  // Da qui cominciano gli schedules

  async insertSchedule(schedule: Partial<Schedule>, routeId: string) {
    try {
      const result = await this.db.collection('routes').updateOne({ id: routeId }, { $addToSet: { schedules: schedule } });
      return result.upsertedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  async updateSchedule(scheduleId: string, schedule: Partial<Schedule>, routeId: string) {
    try {
      const result = await this.db.collection('routes').updateOne(
        {
          id: routeId, // Cerca il documento della route
          'schedules.id': scheduleId, // Assicurati che il documento abbia il schedule da aggiornare
        },
        {
          $set: Object.fromEntries(Object.entries(schedule).map(([key, value]) => [`schedules.$[elem].${key}`, value])),
        },
        {
          arrayFilters: [{ 'elem.id': scheduleId }], // Seleziona l'elemento corretto nell'array
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating schedule:', error);
      throw error;
    }
  }

  async routesToDay() {
    let todayDate = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    let todayDayOfWeek = (new Date().getDay() + 6) % 7; // Converti: Lunedì = 0, Domenica = 6

    return this.db
      .collection('routes')
      .aggregate([
        // 1️⃣ Espandi le `schedules`
        { $unwind: '$schedules' },

        // 2️⃣ Filtra solo le `schedules` attive e valide per oggi
        {
          $match: {
            'schedules.status': 'active',

            // Se la data di oggi è tra `startDate` e `endDate`
            'schedules.startDate': { $lte: todayDate },
            'schedules.endDate': { $gte: todayDate },

            $or: [
              {
                // Caso in cui oggi è una extraDate
                'schedules.extraDates': { $elemMatch: { $eq: todayDate } },
              },
              {
                $and: [
                  {
                    'schedules.daysOfWeek': {
                      $not: {
                        $elemMatch: { $eq: todayDayOfWeek },
                      },
                    },
                  },
                  {
                    // Caso in cui la travelDate non è esclusa dalle excludedDates

                    'schedules.excludedDates': { $nin: [todayDate] },
                  },

                  {
                    'schedules.startDate': { $lte: todayDate },
                    'schedules.endDate': { $gte: todayDate },
                  },
                ],
              },
            ],
          },
        },

        // 3️⃣ Conta il numero di corse attive oggi
        { $count: 'active_schedules_today' },
      ])
      .toArray();
  }

  async routesToDayList() {
    let todayDate = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD
    let todayDayOfWeek = (new Date().getDay() + 6) % 7; // Converti: Lunedì = 0, Domenica = 6

    return this.db
      .collection('routes')
      .aggregate([
        // 1️⃣ Espandi le `schedules`
        { $unwind: '$schedules' },

        // 2️⃣ Filtra solo le `schedules` attive e valide per oggi
        {
          $match: {
            'schedules.status': 'active',

            // Se la data di oggi è tra `startDate` e `endDate`
            'schedules.startDate': { $lte: todayDate },
            'schedules.endDate': { $gte: todayDate },

            $or: [
              {
                // Caso in cui oggi è una extraDate
                'schedules.extraDates': { $elemMatch: { $eq: todayDate } },
              },
              {
                $and: [
                  {
                    'schedules.daysOfWeek': {
                      $not: {
                        $elemMatch: { $eq: todayDayOfWeek },
                      },
                    },
                  },
                  {
                    // Caso in cui la travelDate non è esclusa dalle excludedDates

                    'schedules.excludedDates': { $nin: [todayDate] },
                  },

                  {
                    'schedules.startDate': { $lte: todayDate },
                    'schedules.endDate': { $gte: todayDate },
                  },
                ],
              },
            ],
          },
        },
      ])
      .toArray();
  }

  async currentSchedules() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // Data odierna YYYY-MM-DD
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Orario in minuti

    const todayIndex = now.getDay(); // 0 = Domenica, 1 = Lunedì, ..., 6 = Sabato

    const currentSchedule = this.db.collection('routes').aggregate([
      { $unwind: '$schedules' }, // Espande l'array delle schedule
      {
        $match: {
          'schedules.startDate': { $lte: todayStr }, // StartDate <= oggi
          'schedules.endDate': { $gte: todayStr }, // EndDate >= oggi
          'schedules.status': 'active', // La schedule deve essere attiva
          'schedules.excludedDates': { $ne: todayStr }, // Non deve essere tra le excludedDates
          $or: [
            { 'schedules.daysOfWeek': { $size: 0 } }, // Se vuoto, la schedule è sempre valida
            { 'schedules.daysOfWeek': todayIndex }, // Altrimenti, il giorno della settimana deve combaciare
          ],
        },
      },
      {
        $addFields: {
          departureMinutes: {
            $add: [{ $multiply: [{ $toInt: { $substr: ['$schedules.departureTime', 0, 2] } }, 60] }, { $toInt: { $substr: ['$schedules.departureTime', 3, 2] } }],
          },
          arrivalMinutes: {
            $add: [{ $multiply: [{ $toInt: { $substr: ['$schedules.arrivalTime', 0, 2] } }, 60] }, { $toInt: { $substr: ['$schedules.arrivalTime', 3, 2] } }],
          },
        },
      },
      {
        $match: {
          departureMinutes: { $lte: currentTime }, // La partenza deve essere avvenuta o imminente
          arrivalMinutes: { $gte: currentTime }, // Il viaggio deve essere ancora in corso
        },
      },
      { $sort: { 'schedules.departureTime': 1 } }, // Ordina per partenza più vicina
      // Prende solo la prima schedule valida
    ]);

    return currentSchedule.toArray();
  }

  async listScheduleForBusId(): Promise<any> {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const todayIndex = now.getDay();
      let q = [
        { $unwind: '$schedules' }, // Espande gli schedules
        {
          $match: {
            'schedules.status': 'active',
            'schedules.startDate': { $lte: todayStr }, // startDate <= oggi
            'schedules.endDate': { $gte: todayStr }, // endDate >= oggi
          },
        },
        {
          $match: {
            $or: [
              { 'schedules.daysOfWeek': { $size: 0 } }, // Se `daysOfWeek` è vuoto, è sempre attivo
              { 'schedules.daysOfWeek': { $in: [todayIndex] } }, // Verifica se il giorno è incluso
            ],
          },
        },
        { $unwind: '$schedules.stops' }, // Espande le fermate
        { $match: { 'schedules.stops.status': 'active' } }, // Prende solo fermate attive
        {
          $project: {
            busId: '$schedules.busId',
            scheduleId: '$schedules.id',
            stopId: '$schedules.stops.id',
            stopTime: '$schedules.stops.stopTime',
            stopTimeMinutes: {
              $let: {
                vars: {
                  parts: { $split: ['$schedules.stops.stopTime', ':'] },
                },
                in: {
                  $add: [{ $multiply: [{ $toInt: { $arrayElemAt: ['$$parts', 0] } }, 60] }, { $toInt: { $arrayElemAt: ['$$parts', 1] } }],
                },
              },
            },
            _id: 0,
          },
        },
        { $sort: { busId: 1, stopTimeMinutes: 1 } }, // Ordina per busId e stopTime
        {
          $group: {
            _id: '$busId', // Deve essere _id, non busId separato
            stops: {
              $push: {
                scheduleId: '$scheduleId',
                stopId: '$stopId',
                stopTime: '$stopTime',
                stopTimeMinutes: '$stopTimeMinutes',
              },
            },
          },
        },
        {
          $project: {
            busId: '$_id', // Rinominato _id in busId
            stops: 1,
            _id: 0,
          },
        },
      ];

      let list = await this.db.collection('routes').aggregate(q).toArray();

      return list;
    } catch (error) {
      throw error;
    }
  }
}
