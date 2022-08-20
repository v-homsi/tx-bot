// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GasConsumer is Ownable {
    bool public isLocked;

    constructor() payable {
        isLocked = false;
    }

    function go(uint256 gasAmount) public payable returns (uint256 gasUsed) {
        require(isLocked == false);

        uint256 startGas = gasleft();
        gasUsed = startGas - gasleft();
        while (gasUsed < gasAmount) {
            gasUsed = startGas - gasleft();
        }

        return gasUsed;
    }

    function lock() public onlyOwner {
        require(isLocked == false, "contract already locked");
        isLocked = true;
    }

    function unlock() public onlyOwner {
        require(isLocked == true, "contract already unlocked");
        isLocked = false;
    }
}
