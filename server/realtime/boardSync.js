const jwt = require('jsonwebtoken');
const Board = require('../models/Board');
const User = require('../models/User');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name');
      if (!user) return next(new Error('User no longer exists'));

      socket.data.user = { id: user._id.toString(), name: user.name };
      next();
    } catch (error) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('board:join', async (boardId, acknowledge = () => {}) => {
      if (typeof boardId !== 'string' || !/^[a-f\d]{24}$/i.test(boardId)) {
        return acknowledge({ ok: false, message: 'Invalid board ID' });
      }

      try {
        const board = await Board.findById(boardId).select('owner members');
        const userId = socket.data.user.id;
        const isMember = board && (
          board.owner.toString() === userId ||
          board.members.some((member) => member.user.toString() === userId)
        );
        if (!isMember) return acknowledge({ ok: false, message: 'Board access denied' });

        const previousBoardId = socket.data.boardId;
        if (previousBoardId && previousBoardId !== boardId) {
          await socket.leave(`board:${previousBoardId}`);
          socket.data.boardId = null;
          await emitPresence(previousBoardId);
        }

        socket.data.boardId = boardId;
        await socket.join(`board:${boardId}`);
        const activeUsers = await emitPresence(boardId);
        acknowledge({ ok: true, activeUsers });
      } catch (error) {
        acknowledge({ ok: false, message: 'Could not join board' });
      }
    });

    socket.on('disconnect', () => {
      const boardId = socket.data.boardId;
      if (boardId) emitPresence(boardId);
    });
  });

  async function emitPresence(boardId) {
    const room = `board:${boardId}`;
    const sockets = await io.in(room).fetchSockets();
    const activeUsers = Array.from(
      new Map(sockets.map(({ data }) => [data.user.id, data.user])).values(),
      ({ id, name }) => ({ id, name })
    );
    io.to(room).emit('board:presence', activeUsers);
    return activeUsers;
  }
};
