const amqplib = require("amqplib");
const { v4: uuid4 } = require("uuid");

const MESSAGE_QUEUE_URL = "amqp://localhost:5672";

//  đây là bước khởi tạo instance dùng 1 lần giống việc khởi tạo  instance của DB
let amqplibConnection = null;

const getChannel = async () => {
  if (!amqplibConnection) {
    amqplibConnection = await amqplib.connect(MESSAGE_QUEUE_URL);
  }
  return await amqplibConnection.createChannel();
};

// khởi tạo 1 RPCObserver để lắng nghe các RPCRequest đến và trả về data cho các request đó
const RPCObserver = async (RPC_QUEUE_NAME, fakeData) => {
  try {
    // khởi tạo 1 channel
    const channel = await getChannel();
    // đăng ký 1 queue dự trên RPC_QUEUE_NAME cố định
    channel.assertQueue(RPC_QUEUE_NAME, {
      durable: false,
    });
    channel.prefetch(1);
    // consume: giải quyết các message đến queue
    (await channel).consume(
      RPC_QUEUE_NAME,
      async (msg) => {
        if (msg.content) {
          const payload = JSON.parse(msg.content.toString());
          const response = { fakeData, payload };

          // trả về response cho RPCRequest (bằng cách gửi 1 message có chứa response và queue của RPCRequest đó)
          channel.sendToQueue(
            msg.properties.replyTo,
            Buffer(JSON.stringify(response)),
            { correlationId: msg.properties.correlationId }
          );
          // **autoAck: true => gửi thông tin cho RabbitMQ biết là đã nhận message
          // ** và có thể xóa nó
          // ** nhưng nếu tác vụ nặng chỉ 1 phần của Task hoàn thành và nó die
          // ** lúc này message đã bị xóa khỏi queue và task sẽ bị mất
          // !! không để auto mà dùng channel.ack để thông báo xóa mỗi khi hoàn thành task đó
          // gửi ack(msg) để nói với RabbitMQ là nó đã xử lý xong rồi
          // Nên có thể xóa msg này đi
          (await channel).ack(msg);
        }
      },
      // vì channel đã gửi ack để xóa message rồi thì không cần gửi ack thông báo làm gì nữa
      // nên noAck = false (không gửi tín hiệu đến RabbitMQ để xóa message)
      {
        noAck: false,
      }
    );
  } catch (error) {
    console.log(error);
    return "error";
  }
};

// Khỏi tạo 1 RPCRequest Queue để gửi request đến RPCObserver Queue và nhận lại message response từ RPCObserver Queue
const requestData = async (RPC_QUEUE_NAME, requestPayload, uuid) => {
  try {
    // khỏi tạo 1 channel
    const channel = await getChannel();

    // đăng ký 1 queue không tên (queue name sẽ được sinh ra ngẫu nhiên tương ứng với mỗi request)
    // vì có nhiều request nên => sẽ có nhiều queue nặc danh được mở tương ứng => nên khi dùng xong, tức là nhận được response => consume xong => close channel
    const requestQueue = (await channel).assertQueue("", { exclusive: true });

    // gửi 1 requestPayload đế RPCObserver để get data
    (await channel).sendToQueue(
      RPC_QUEUE_NAME,
      Buffer(JSON.stringify(requestPayload)),
      {
        replyTo: (await requestQueue).queue,
        correlationId: uuid,
      }
    );
    // nhận lại message response từ RPCObserver => consume message đó => close channel
    // set thời gian nhận message response để close channel.
    return new Promise((resolve, reject) => {
      channel.consume(
        requestData.queue,
        (msg) => {
          if (msg.properties.correlationId == uuid) {
            // đúng với id của request yêu cầu thì xử lý
            resolve(JSON.parse(msg.content.toString()));
          } else {
            reject("Data Not Found ");
          }
        },
        {
          noAck: true,
        }
      );
    });
  } catch (error) {
    console.log(error);
    return "error";
  }
};

const RPCRequest = async (RPC_QUEUE_NAME, requestPayload) => {
  const uuid = uuid4(); // correlationId
  return await requestData(RPC_QUEUE_NAME, requestPayload, uuid);
};

module.exports = {
  getChannel,
  RPCObserver,
  RPCRequest,
};
