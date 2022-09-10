const { expect } = require("chai");

/**
 * Functionality that is strictly from the OZ contract AccessControlEnumerable
 * is not tested here.
 *
 * The tests below only tackle EarnToken-specific functionality. They are written
 * assuming that the OZ contract behaves as expected.
 */

describe("EarnToken contract", function () {
  let EarnToken;
  let earnToken;
  let deployer;
  let attacker;
  let operator; // default admin, can grant / revoke roles

  let tokenUser1, tokenUser2, tokenUser3;

  let TOKEN_USER_ROLE;

  beforeEach(async function () {
    deployer = (await ethers.getSigners())[0];
    operator = (await ethers.getSigners())[1];
    tokenUser1 = (await ethers.getSigners())[2];
    tokenUser2 = (await ethers.getSigners())[3];
    tokenUser3 = (await ethers.getSigners())[4];
    attacker = (await ethers.getSigners())[10];
    EarnToken = await ethers.getContractFactory("EarnToken");
    earnToken = await EarnToken.deploy("EarnToken", "EARN", operator.address);

    try {
      TOKEN_USER_ROLE = await earnToken.TOKEN_USER();
    } catch (e) {
      console.error("Could not retrieve TOKEN USER role");
    }
  });

  // ============= TOKEN OWNERSHIP

  it("The contract publicly states a total supply of 1 Million", async function () {
    const sup = await earnToken.TOTAL_SUPPLY;
  });

  it("There is a token supply of 1 Million", async function () {
    const sup = await earnToken.totalSupply();
    expect(sup).to.be.equal(ethers.utils.parseEther("1").mul(10 ** 6));
  });

  it("The assigned operator owns the total supply", async function () {
    const owned = await earnToken.balanceOf(operator.address);
    const sup = await earnToken.totalSupply();
    expect(owned).to.be.equal(sup);
  });

  // ============= GRANT & REVOKE ROLES

  it("The contract has TOKEN_USER role that is publicly retrievable", async function () {
    expect(TOKEN_USER_ROLE).to.not.be.equal(undefined);
  });

  it("The assigned operator is an admin of the TOKEN_USER role", async function () {
    const adminRole = await earnToken.getRoleAdmin(TOKEN_USER_ROLE);
    const isOperatorAdmin = await earnToken.hasRole(
      adminRole,
      operator.address
    );
    expect(isOperatorAdmin).to.be.true;
  });

  it("The assigned operator can add and revoke TOKEN_USER roles", async function () {
    const tuAddress = tokenUser1.address;
    expect(await earnToken.hasRole(TOKEN_USER_ROLE, tuAddress)).to.be.false;
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tuAddress);
    expect(await earnToken.hasRole(TOKEN_USER_ROLE, tuAddress)).to.be.true;
    await earnToken.connect(operator).revokeRole(TOKEN_USER_ROLE, tuAddress);
    expect(await earnToken.hasRole(TOKEN_USER_ROLE, tuAddress)).to.be.false;
  });

  it("An account without DEFAULT_ADMIN_ROLE cannot grant / revoke TOKEN_USER roles", async function () {
    const adminRole = await earnToken.getRoleAdmin(TOKEN_USER_ROLE);
    expect(await earnToken.hasRole(adminRole, attacker.address)).to.be.false;
    expect(
      earnToken.connect(attacker).grantRole(TOKEN_USER_ROLE, attacker.address)
    ).to.be.revertedWith(
      `AccessControl: account ${attacker.address} is missing role ${adminRole}`
    );
  });

  it("All TOKEN_USER accounts can be retrieved via a single call", async function () {
    const tu1Address = tokenUser1.address;
    const tu2Address = tokenUser2.address;
    const tu3Address = tokenUser3.address;
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tu1Address);
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tu2Address);
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tu3Address);
    const tokenUsers = await earnToken.getTokenUsers();
    expect(tokenUsers).to.eql([tu1Address, tu2Address, tu3Address]);
  });

  // // ============ TRANSFER TOKENS

  it("An account with TOKEN_USER role can send EARN tokens to another account with TOKEN_USER role", async function () {
    const tuAddress = tokenUser1.address; // intended receiver
    await earnToken
      .connect(operator)
      .grantRole(TOKEN_USER_ROLE, operator.address); // intended sender
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tuAddress);
    const tuBefore = await earnToken.balanceOf(tuAddress);
    const amount = ethers.utils.parseEther("1");
    // operator is a TOKEN USER
    await earnToken.connect(operator).transfer(tuAddress, amount);
    const tuAfter = await earnToken.balanceOf(tuAddress);
    expect(tuAfter.sub(tuBefore)).to.equal(amount);
  });

  it("An account without TOKEN_USER role cannot send EARN tokens", async function () {
    const tuAddress = tokenUser1.address;
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tuAddress);
    const amount = ethers.utils.parseEther("1");
    // operator is NOT a TOKEN USER
    expect(
      earnToken.connect(operator).transfer(tuAddress, amount)
    ).to.be.revertedWith(
      `AccessControl: account ${operator.address} is missing role ${TOKEN_USER_ROLE}`
    );
  });

  it("An account without TOKEN_USER role cannot receive EARN tokens", async function () {
    const tuAddress = tokenUser1.address;
    await earnToken
      .connect(operator)
      .grantRole(TOKEN_USER_ROLE, deployer.address);
    expect(await earnToken.hasRole(TOKEN_USER_ROLE, tuAddress)).to.be.false;
    const amount = ethers.utils.parseEther("1");
    expect(
      earnToken.connect(operator).transfer(tuAddress, amount)
    ).to.be.revertedWith(
      `AccessControl: account ${tuAddress} is missing role ${TOKEN_USER_ROLE}`
    );
  });

  it("An account without TOKEN_USER role that has allowance can initiate transfer between TOKEN_USER accounts", async function () {
    const tuAddress1 = tokenUser1.address; // user1 should be the "to"
    const tuAddress2 = tokenUser2.address; // gets allowance to transfer
    await earnToken
      .connect(operator)
      .grantRole(TOKEN_USER_ROLE, operator.address); // operator should be the "from"
    await earnToken.connect(operator).grantRole(TOKEN_USER_ROLE, tuAddress1);
    expect(await earnToken.hasRole(TOKEN_USER_ROLE, tuAddress2)).to.be.false; // is no TOKEN USER

    const tuBefore = await earnToken.balanceOf(tuAddress1);
    const amount = ethers.utils.parseEther("1");
    await earnToken.connect(operator).approve(tuAddress2, amount);
    await earnToken
      .connect(tokenUser2)
      .transferFrom(operator.address, tuAddress1, amount);
    const tuAfter = await earnToken.balanceOf(tuAddress1);
    expect(tuAfter.sub(tuBefore)).to.equal(amount);
  });
});
