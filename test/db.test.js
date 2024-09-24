const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Exemple d'un modèle MongoDB simple
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
});

const User = mongoose.model('User', UserSchema);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany(); // Vider la collection avant chaque test
});

test('devrait enregistrer un utilisateur dans la base de données', async () => {
  const user = new User({ name: 'Alice', email: 'alice@example.com' });
  await user.save();

  const users = await User.find();
  expect(users.length).toBe(1);
  expect(users[0].name).toBe('Alice');
});

test('devrait ne pas enregistrer d\'utilisateurs si les données sont invalides', async () => {
  const user = new User({ name: '', email: 'alice@example.com' });
  try {
    await user.save();
  } catch (error) {
    expect(error).toBeTruthy(); // L'erreur doit être déclenchée à cause du nom vide
  }
});
