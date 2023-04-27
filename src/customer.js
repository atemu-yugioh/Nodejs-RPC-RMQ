const express = require("express");
const { RPCObserver, RPCRequest } = require("./rpc");
const PORT = 9000;

const app = express();

app.use(express.json());

const fakeCustomerResponse = {
  _id: "yt686tu8763tyyr98734",
  name: "Mike",
  country: "Poland",
};

RPCObserver("CUSTOMER_RPC", fakeCustomerResponse);

app.use("/wishlist", async (req, res, next) => {
  const requestPayload = {
    productId: "123",
    customerId: "yt686tu8763tyyr98734",
  };

  try {
    const responseData = await RPCRequest("PRODUCT_RPC", requestPayload);
    console.log(responseData);
    return res.status(200).json(responseData);
  } catch (error) {
    return res.status(500).json(error);
  }
});

app.use("/", (req, res, next) => {
  return res.json("Customer Service");
});

app.listen(PORT, () => {
  console.log(`Customer is Running on ${PORT}`);
  console.clear();
});
