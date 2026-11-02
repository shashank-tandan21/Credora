// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ReentrantToken
/// @notice TEST ONLY. ERC-20 that calls back into a configured target during every
///         balance update, used to prove reentrancy guards hold. Never deploy.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public callData;
    bool private _entered;

    error ReentryFailed(bytes reason);

    constructor() ERC20("Reentrant Token", "REENTER") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bytes calldata callData_) external {
        target = target_;
        callData = callData_;
    }

    function disarm() external {
        target = address(0);
        delete callData;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (target != address(0) && !_entered) {
            _entered = true;
            (bool ok, bytes memory reason) = target.call(callData);
            _entered = false;
            if (!ok) revert ReentryFailed(reason);
        }
    }
}
